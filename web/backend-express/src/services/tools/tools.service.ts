import { existsSync } from 'node:fs';
import { availableParallelism, totalmem } from 'node:os';
import { unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { MODELS, type ModelEntry } from '../../config/model-catalog.js';
import type { AppConfig, WhisperConfig } from '../../config/env.js';
import { appLogger } from '../../lib/app-logger.js';
import { HttpError } from '../../models/errors.js';
import type { SettingsRepository } from '../../repositories/settings.repository.js';
import type { ToolsRepository } from '../../repositories/tools.repository.js';
import { type Clock, systemClock } from '../../lib/clock.js';
import { findExecutable, type SpeechEngine } from '../ai-subtitles/whisper-server.js';
import { BenchmarkService, type BenchmarkState, type Candidate } from './benchmark.service.js';
import {
  freeSpaceOf,
  isInstalled,
  ModelDownloadService,
  partialBytes,
  type DownloadState,
} from './model-download.service.js';
import { availableVariants, whisperBin, type Variant } from './tool-paths.js';

const OLD_DEFAULT_MODEL_ID = 'large-v3-turbo-q5_0';
const SMALL_MODEL_ID = 'small-q5_1';
/** A model slower than this (times real time) steps down to the small model on first setup. */
const STEP_DOWN_ABOVE = 0.5;
const DESKTOP_PROBLEM = 'Part of the app is missing. Please reinstall Echo.';
const GB = 1024 * 1024 * 1024;

/** The whisper settings. The engine reads them on every use, so changes apply at once. */
export type MutableWhisper = { -readonly [K in keyof WhisperConfig]: WhisperConfig[K] };

export interface Hardware {
  totalMemory(): number;
  cpus(): number;
}

export interface ToolsServiceDeps {
  readonly config: AppConfig;
  readonly settings: Pick<SettingsRepository, 'raw' | 'getBoolean' | 'setRaw'>;
  readonly repository: ToolsRepository;
  readonly whisper: MutableWhisper;
  /** The speech engine. Closed on a model change, so it restarts with the new model. */
  readonly engine: { close(): Promise<void> };
  /** Null when AI subtitles are not wired (tests). */
  readonly aiSubtitles: { resetAvailability(): void } | null;
  readonly fetch: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly freeSpace?: (dir: string) => Promise<number>;
  readonly hardware?: Hardware;
  /** A speech engine for one engine build and model file (the speed test uses it). */
  readonly engineFor: (binary: string, modelPath: string) => SpeechEngine;
  readonly clock?: Clock;
}

export interface ToolsModel {
  readonly id: string;
  readonly title: string;
  readonly note: string;
  readonly size: number;
  readonly installed: boolean;
  readonly selected: boolean;
  readonly recommended: boolean;
  readonly partialBytes: number;
}

/** Answer of `GET /api/tools`. The UI polls it while setup runs. */
export interface ToolsStatus {
  readonly desktop: boolean;
  readonly appVersion: string | null;
  readonly ffmpeg: { readonly found: boolean };
  readonly engine: { readonly variants: Variant[]; readonly selected: Variant | null };
  readonly models: ToolsModel[];
  readonly download: DownloadState;
  readonly benchmark: {
    readonly status: 'idle' | 'running' | 'done' | 'failed';
    readonly speedFactor: number | null;
    readonly message: string | null;
  };
  readonly freeDiskBytes: number;
  /** The `aiSubtitles` setting. */
  readonly enabled: boolean;
  /** The user paused the download; it resumes only when they resume it. */
  readonly paused: boolean;
  /** The model whose download is paused, or null. */
  readonly pausedModelId: string | null;
  /** Why automatic setup cannot continue, or null. */
  readonly problem: string | null;
  /** FFmpeg found, an engine variant exists and the selected model is installed. */
  readonly ready: boolean;
}

/** Sets up the subtitle engine and its model. Turning the switch on is the only user action. */
export class ToolsService {
  private problem: string | null = null;
  private readonly download: ModelDownloadService;
  private readonly benchmark: BenchmarkService;
  private readonly hardware: Hardware;
  private readonly clock: Clock;

  constructor(private readonly deps: ToolsServiceDeps) {
    this.hardware = deps.hardware ?? {
      totalMemory: () => totalmem(),
      cpus: () => availableParallelism(),
    };
    this.clock = deps.clock ?? systemClock;
    this.download = new ModelDownloadService({
      modelsDir: deps.config.modelsDir,
      fetch: deps.fetch,
      sleep: deps.sleep,
      freeSpace: deps.freeSpace,
      onInstalled: (modelId) => this.onModelInstalled(modelId),
    });
    this.benchmark = new BenchmarkService({
      sample: deps.config.benchSample,
      engineFor: deps.engineFor,
      clock: this.clock,
    });
  }

  /**
   * Applies the saved choices at start-up. In the desktop app AI subtitles start off. When they
   * are already on, an interrupted setup continues by itself.
   */
  async init(): Promise<void> {
    const { config, settings } = this.deps;
    const desktop = config.desktopVersion !== null;
    if (desktop && settings.raw('aiSubtitles') === undefined) {
      await settings.setRaw('aiSubtitles', false);
    }
    await this.applySavedChoices();
    // A paused download stays paused until the user resumes it.
    const paused = this.deps.repository.get().paused === true;
    if (
      desktop &&
      !paused &&
      this.deps.aiSubtitles !== null &&
      this.enabled() &&
      !(await this.isReady())
    ) {
      this.startSetup();
    }
  }

  async status(): Promise<ToolsStatus> {
    const { config, whisper, repository, settings } = this.deps;
    const saved = repository.get();
    const variants = await this.engineVariants();
    const ffmpegFound = (await findExecutable(whisper.ffmpegBin)) !== null;
    const recommended = this.recommendedModelId();
    const models: ToolsModel[] = await Promise.all(
      MODELS.map(async (m) => ({
        id: m.id,
        title: m.title,
        note: m.note,
        size: m.size,
        installed: await isInstalled(config.modelsDir, m),
        selected: saved.modelId === m.id,
        recommended: m.id === recommended,
        partialBytes: await partialBytes(config.modelsDir, m),
      })),
    );
    const selectedVariant =
      saved.variant !== undefined && variants.includes(saved.variant)
        ? saved.variant
        : (variants[0] ?? null);
    const selectedInstalled = models.some((m) => m.selected && m.installed);
    return {
      desktop: config.desktopVersion !== null,
      appVersion: config.desktopVersion,
      ffmpeg: { found: ffmpegFound },
      engine: { variants, selected: selectedVariant },
      models,
      download: this.download.state(),
      benchmark: this.benchmarkView(saved.speedFactor),
      freeDiskBytes: await this.freeDisk(),
      enabled: settings.getBoolean('aiSubtitles') ?? true,
      paused: saved.paused === true,
      pausedModelId: saved.pausedModelId ?? null,
      problem: this.problem,
      ready: ffmpegFound && variants.length > 0 && selectedInstalled,
    };
  }

  /** Resume after a pause (or the switch being turned on): clears the pause and runs the setup. */
  async resume(): Promise<void> {
    await this.deps.repository.update({ paused: false, pausedModelId: undefined });
    this.startSetup();
  }

  /** Starts the automatic setup in the background. */
  startSetup(): void {
    this.ensureReady().catch((err: unknown) => {
      appLogger().error({ err }, 'AI subtitle setup failed');
    });
  }

  /**
   * The automatic setup. It never asks the user anything: it checks the tools, picks a model,
   * downloads it (resuming a partial file) and selects it.
   */
  async ensureReady(): Promise<void> {
    if (this.download.isBusy()) return;
    const status = await this.status();
    if (status.ready) {
      this.problem = null;
      return;
    }
    if (!status.ffmpeg.found || status.engine.variants.length === 0) {
      this.problem = DESKTOP_PROBLEM;
      return;
    }
    this.problem = null;

    const entry = await this.pickModel();
    if (!(await isInstalled(this.deps.config.modelsDir, entry))) {
      await this.download.start(entry.id);
      return;
    }
    if (this.deps.repository.get().modelId !== entry.id) {
      await this.useModel(entry);
      await this.afterModelChange();
      this.scheduleSpeedTest();
    }
  }

  /** Runs the speed test in the background. Used by `POST /api/tools/benchmark`. */
  async startBenchmark(): Promise<void> {
    if (this.download.isBusy()) {
      throw HttpError.badRequest('A download is running. Wait for it to finish.');
    }
    if (this.benchmark.isRunning())
      throw HttpError.badRequest('The speed test is already running.');
    const entry = MODELS.find((m) => m.id === this.deps.repository.get().modelId);
    if (!entry || !(await isInstalled(this.deps.config.modelsDir, entry))) {
      throw HttpError.badRequest('Install a model first.');
    }
    this.scheduleSpeedTest();
  }

  /**
   * Pause: stops the download and keeps its partial file. It does not restart by itself: the
   * user resumes it, or it resumes when the switch is turned on again.
   */
  async pauseDownload(): Promise<void> {
    const modelId = this.download.activeModelId();
    await this.download.cancel();
    await this.deps.repository.update({ paused: true, pausedModelId: modelId ?? undefined });
  }

  /** Cancel: stops the download and deletes the partial file. */
  async cancelDownload(): Promise<void> {
    const modelId = this.download.activeModelId() ?? this.deps.repository.get().pausedModelId;
    await this.download.cancel();
    if (modelId) await this.download.removePartial(modelId);
    await this.deps.repository.update({ paused: false, pausedModelId: undefined });
  }

  async downloadModel(id: string): Promise<void> {
    await this.download.start(id);
  }

  async selectModel(id: string): Promise<void> {
    const entry = findModel(id);
    if (!(await isInstalled(this.deps.config.modelsDir, entry))) {
      throw HttpError.badRequest('That model is not installed yet.');
    }
    // Only the Settings page reaches this method, so the choice is the user's own.
    await this.deps.repository.update({ modelPickedByUser: true });
    await this.useModel(entry);
    await this.afterModelChange();
  }

  /**
   * Deletes a downloaded model. Deleting the model in use switches to another installed model. If
   * it was the last one, AI subtitles are turned off, so nothing downloads it again by itself.
   */
  async deleteModel(id: string): Promise<void> {
    const entry = findModel(id);
    const { config, repository, settings } = this.deps;
    if (repository.get().modelId === id) {
      const other = await this.firstInstalledOther(id);
      if (other) {
        await this.useModel(other);
      } else {
        await settings.setRaw('aiSubtitles', false);
      }
      await this.afterModelChange();
    }
    await unlink(join(config.modelsDir, entry.file)).catch((err: unknown) => {
      if (!isNotFound(err)) throw err;
    });
  }

  /** The model that suits this computer, from the rules in the plan (refined by the speed test). */
  recommendedModelId(): string {
    const large = 'large-v3-turbo-q5_0';
    if (availableVariants(this.deps.config.binDir).includes('metal')) return large;
    const roomy = this.hardware.totalMemory() >= 8 * GB && this.hardware.cpus() >= 8;
    return roomy ? large : 'small-q5_1';
  }

  close(): void {
    this.download.close();
  }

  private enabled(): boolean {
    return this.deps.settings.getBoolean('aiSubtitles') ?? true;
  }

  private async isReady(): Promise<boolean> {
    return (await this.status()).ready;
  }

  /** Loads the saved model and engine variant. Adopts the model of the old setup script. */
  private async applySavedChoices(): Promise<void> {
    const { config, repository, whisper } = this.deps;
    let saved = repository.get();
    if (saved.modelId === undefined) {
      const old = findModel(OLD_DEFAULT_MODEL_ID);
      if (await isInstalled(config.modelsDir, old)) {
        await repository.update({ modelId: old.id });
        saved = repository.get();
      }
    }
    const chosen = MODELS.find((m) => m.id === saved.modelId);
    if (chosen && (await isInstalled(config.modelsDir, chosen))) {
      whisper.model = join(config.modelsDir, chosen.file);
    }
    if (saved.variant !== undefined && (await this.engineVariants()).includes(saved.variant)) {
      whisper.whisperServerBin = whisperBin(
        config.binDir,
        saved.variant,
        config.whisper.whisperServerBin,
      );
    }
  }

  /** The model to use: the selected one, else an installed one, else the recommended one. */
  private async pickModel(): Promise<ModelEntry> {
    const selected = MODELS.find((m) => m.id === this.deps.repository.get().modelId);
    if (selected) return selected;
    for (const m of MODELS) {
      if (await isInstalled(this.deps.config.modelsDir, m)) return m;
    }
    return findModel(this.recommendedModelId());
  }

  /** Called when a model file is saved and checked. The speed test runs in the background. */
  private async onModelInstalled(modelId: string): Promise<void> {
    const saved = this.deps.repository.get();
    if (saved.benchmarkPending === modelId) {
      // The step-down download is done: use it and time it.
      await this.deps.repository.update({ benchmarkPending: undefined });
      await this.useModel(findModel(modelId));
      await this.afterModelChange();
      this.scheduleSpeedTest();
      return;
    }
    if (saved.modelId !== undefined && saved.modelId !== modelId) return;
    await this.useModel(findModel(modelId));
    await this.afterModelChange();
    // The first model ever installed is timed, so the speed is known before the user needs it.
    if (saved.speedFactor === undefined) this.scheduleSpeedTest();
  }

  private scheduleSpeedTest(): void {
    if (this.benchmark.isRunning()) return;
    this.measureSelected().catch((err: unknown) => {
      appLogger().error({ err }, 'AI subtitle speed test failed');
    });
  }

  /**
   * Times the selected model on each engine build and keeps the best. On the first setup, a
   * model that is too slow for this computer steps down once to the small model, unless the
   * user picked the model in Settings.
   */
  private async measureSelected(): Promise<void> {
    const { config, repository, whisper } = this.deps;
    const saved = repository.get();
    const entry = MODELS.find((m) => m.id === saved.modelId);
    if (!entry || !(await isInstalled(config.modelsDir, entry))) return;

    const result = await this.benchmark.run(
      join(config.modelsDir, entry.file),
      await this.candidates(),
    );
    if (!result) return;
    await repository.update({
      variant: result.variant,
      speedFactor: result.speedFactor,
      benchmarkedAt: new Date(this.clock.now()).toISOString(),
    });
    whisper.whisperServerBin = result.binary;
    await this.afterModelChange();

    const firstSetup = saved.speedFactor === undefined;
    const tooSlow = result.speedFactor > STEP_DOWN_ABOVE;
    if (
      firstSetup &&
      tooSlow &&
      entry.id !== SMALL_MODEL_ID &&
      !saved.modelPickedByUser &&
      !saved.steppedDown
    ) {
      await this.stepDown();
    }
  }

  /** Switches to the small model, downloading it first if needed. Happens at most once. */
  private async stepDown(): Promise<void> {
    const { config, repository } = this.deps;
    const small = findModel(SMALL_MODEL_ID);
    await repository.update({ steppedDown: true });
    if (await isInstalled(config.modelsDir, small)) {
      await this.useModel(small);
      await this.afterModelChange();
      this.scheduleSpeedTest();
      return;
    }
    await repository.update({ benchmarkPending: small.id });
    try {
      await this.download.start(small.id);
    } catch (err) {
      await repository.update({ benchmarkPending: undefined });
      throw err;
    }
  }

  /** Engine builds to time, best first: the bundled ones, or the system whisper-server. */
  private async candidates(): Promise<Candidate[]> {
    const { config } = this.deps;
    return (await this.engineVariants()).map((variant) => ({
      variant,
      binary: whisperBin(config.binDir, variant, config.whisper.whisperServerBin),
    }));
  }

  private benchmarkView(savedSpeed: number | undefined): ToolsStatus['benchmark'] {
    const current: BenchmarkState = this.benchmark.state();
    return {
      status: current.status,
      speedFactor: current.speedFactor ?? savedSpeed ?? null,
      message: current.message,
    };
  }

  private async useModel(entry: ModelEntry): Promise<void> {
    await this.deps.repository.update({ modelId: entry.id });
    this.deps.whisper.model = join(this.deps.config.modelsDir, entry.file);
  }

  /** Makes the engine restart with the new model and re-checks availability at once. */
  private async afterModelChange(): Promise<void> {
    await this.deps.engine.close();
    this.deps.aiSubtitles?.resetAvailability();
  }

  private async firstInstalledOther(id: string): Promise<ModelEntry | undefined> {
    for (const m of MODELS) {
      if (m.id !== id && (await isInstalled(this.deps.config.modelsDir, m))) return m;
    }
    return undefined;
  }

  /** Bundled engine variants in the desktop app; the system whisper-server otherwise. */
  private async engineVariants(): Promise<Variant[]> {
    const { config, whisper } = this.deps;
    if (config.binDir !== null) return availableVariants(config.binDir);
    return (await findExecutable(whisper.whisperServerBin)) !== null ? ['system'] : [];
  }

  /** Free space on the disk that will hold the models (the nearest existing folder). */
  private async freeDisk(): Promise<number> {
    let dir = this.deps.config.modelsDir;
    while (!existsSync(dir) && dirname(dir) !== dir) dir = dirname(dir);
    return (this.deps.freeSpace ?? freeSpaceOf)(dir);
  }
}

function findModel(id: string): ModelEntry {
  const entry = MODELS.find((m) => m.id === id);
  if (!entry) throw HttpError.badRequest('Unknown model.');
  return entry;
}

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === 'ENOENT';
}
