import { chmod, mkdir, stat, truncate, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MODELS, VAD_MODEL } from '../../src/config/model-catalog.js';
import { loadConfig, type AppConfig } from '../../src/config/env.js';
import type { SpeechEngine } from '../../src/services/ai-subtitles/whisper-server.js';
import { SettingsRepository } from '../../src/repositories/settings.repository.js';
import { ToolsRepository } from '../../src/repositories/tools.repository.js';
import {
  ToolsService,
  type Hardware,
  type MutableWhisper,
} from '../../src/services/tools/tools.service.js';
import { EXE } from '../../src/services/tools/tool-paths.js';
import { tempDir } from '../helpers/tmp.js';

const GB = 1024 * 1024 * 1024;
const LARGE = MODELS.find((m) => m.id === 'large-v3-turbo-q5_0')!;
const SMALL = MODELS.find((m) => m.id === 'small-q5_1')!;
const PROBLEM = 'Part of the app is missing. Please reinstall Echo.';

let t: { dir: string; cleanup: () => Promise<void> };
let services: ToolsService[];
let fetchCalls: { url: string; range: string | undefined }[];
let engineCloses: number;
let resets: number;

async function putBinary(path: string): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, '#!/bin/sh\n');
  await chmod(path, 0o755);
}

/** An empty file of the catalog size: looks installed without taking disk space. */
async function fakeInstall(entry: { file: string; size: number }): Promise<void> {
  const path = join(t.dir, 'models', entry.file);
  await mkdir(join(t.dir, 'models'), { recursive: true });
  await writeFile(path, '');
  await truncate(path, entry.size);
}

/** Desktop-style config: bundled tools under `bin/`, with a bundled ffmpeg. */
/** The real speed-test sample shipped with the package. */
const REAL_SAMPLE = fileURLToPath(new URL('../../assets/benchmark.wav', import.meta.url));

/** Milliseconds one fake transcription takes; it moves the fake clock forward. */
let benchCostMs = 1000;
let clockMs = 0;
const fakeClock = { now: () => clockMs };

/** Engines for the speed test: each transcription costs `benchCostMs`. */
const fakeEngineFor = (): SpeechEngine => ({
  unavailableReason: () => Promise.resolve(null),
  transcribe: () => {
    clockMs += benchCostMs;
    return Promise.resolve([]);
  },
  close: () => Promise.resolve(),
});

function desktopConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const base = loadConfig({ ECHO_WEB_DATA: t.dir, LOG_LEVEL: 'silent' });
  return { ...base, binDir: null, desktopVersion: null, benchSample: REAL_SAMPLE, ...overrides };
}

/** Fake fetch: records calls and never answers, but stops when the request is aborted. */
const hangingFetch: typeof fetch = (input, init) => {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  fetchCalls.push({ url: href, range: new Headers(init?.headers).get('Range') ?? undefined });
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(new DOMException('aborted', 'AbortError'));
    });
  });
};

interface MakeOptions {
  config?: AppConfig;
  hardware?: Hardware;
  aiSubtitles?: boolean;
  whisperOverrides?: Partial<MutableWhisper>;
}

function makeService(options: MakeOptions = {}): {
  svc: ToolsService;
  settings: SettingsRepository;
  repo: ToolsRepository;
  whisper: MutableWhisper;
  config: AppConfig;
} {
  const config = options.config ?? desktopConfig();
  const settings = new SettingsRepository(join(t.dir, 'settings.json'));
  const repo = new ToolsRepository(join(t.dir, 'tools.json'));
  const whisper: MutableWhisper = { ...config.whisper, ...options.whisperOverrides };
  const svc = new ToolsService({
    config,
    settings,
    repository: repo,
    whisper,
    engine: {
      close: () => {
        engineCloses++;
        return Promise.resolve();
      },
    },
    aiSubtitles:
      options.aiSubtitles === false
        ? null
        : {
            resetAvailability: () => {
              resets++;
            },
          },
    fetch: hangingFetch,
    sleep: () => Promise.resolve(),
    freeSpace: () => Promise.resolve(50 * GB),
    hardware: options.hardware ?? { totalMemory: () => 16 * GB, cpus: () => 10 },
    engineFor: fakeEngineFor,
    clock: fakeClock,
  });
  services.push(svc);
  return { svc, settings, repo, whisper, config };
}

/** A desktop folder with a bundled ffmpeg and a CPU engine, so setup has the tools it needs. */
async function withBundledTools(): Promise<AppConfig> {
  const binDir = join(t.dir, 'bin');
  await putBinary(join(binDir, `ffmpeg${EXE}`));
  await putBinary(join(binDir, 'whisper', 'cpu', `whisper-server${EXE}`));
  // The voice-detection file is fetched before the model; install it so tests reach the model.
  await fakeInstall(VAD_MODEL);
  return desktopConfig({ binDir, desktopVersion: '0.1.0' });
}

beforeEach(async () => {
  t = await tempDir();
  services = [];
  fetchCalls = [];
  engineCloses = 0;
  resets = 0;
});

afterEach(async () => {
  for (const svc of services) svc.close();
  await t.cleanup();
});

describe('recommendedModelId', () => {
  it('picks the best model when the bundled engine has Metal', async () => {
    await putBinary(join(t.dir, 'bin', 'whisper', 'metal', `whisper-server${EXE}`));
    const config = desktopConfig({ binDir: join(t.dir, 'bin') });
    const { svc } = makeService({ config, hardware: { totalMemory: () => 2 * GB, cpus: () => 2 } });
    expect(svc.recommendedModelId()).toBe('large-v3-turbo-q5_0');
  });

  it('picks the best model with 8 GB of memory and 8 processors', () => {
    const { svc } = makeService({ hardware: { totalMemory: () => 8 * GB, cpus: () => 8 } });
    expect(svc.recommendedModelId()).toBe('large-v3-turbo-q5_0');
  });

  it('picks the fastest model when memory or processors are short', () => {
    expect(
      makeService({
        hardware: { totalMemory: () => 4 * GB, cpus: () => 16 },
      }).svc.recommendedModelId(),
    ).toBe('small-q5_1');
    expect(
      makeService({
        hardware: { totalMemory: () => 16 * GB, cpus: () => 4 },
      }).svc.recommendedModelId(),
    ).toBe('small-q5_1');
  });
});

describe('selectModel and deleteModel', () => {
  it('refuses a model that is not installed', async () => {
    const { svc } = makeService();
    await expect(svc.selectModel(SMALL.id)).rejects.toMatchObject({ status: 400 });
  });

  it('selects an installed model, restarts the engine and resets availability', async () => {
    await fakeInstall(SMALL);
    const { svc, repo, whisper } = makeService();
    await svc.selectModel(SMALL.id);

    expect(repo.get().modelId).toBe(SMALL.id);
    expect(whisper.model).toBe(join(t.dir, 'models', SMALL.file));
    expect(engineCloses).toBe(1);
    expect(resets).toBe(1);
  });

  it('deleting the last model removes it and turns AI subtitles off', async () => {
    await fakeInstall(SMALL);
    const { svc, settings } = makeService();
    await svc.selectModel(SMALL.id);
    await svc.deleteModel(SMALL.id);

    await expect(stat(join(t.dir, 'models', SMALL.file))).rejects.toThrow();
    expect(settings.getBoolean('aiSubtitles')).toBe(false);
  });

  it('deleting the model in use switches to another installed model', async () => {
    await fakeInstall(SMALL);
    await fakeInstall(LARGE);
    const { svc, repo } = makeService();
    await svc.selectModel(LARGE.id);
    await svc.deleteModel(LARGE.id);

    expect(repo.get().modelId).toBe(SMALL.id);
    expect((await stat(join(t.dir, 'models', SMALL.file))).size).toBe(SMALL.size);
  });

  it('deletes a model that is not selected', async () => {
    await fakeInstall(SMALL);
    await fakeInstall(LARGE);
    const { svc, repo } = makeService();
    await svc.selectModel(LARGE.id);
    await svc.deleteModel(SMALL.id);
    await expect(stat(join(t.dir, 'models', SMALL.file))).rejects.toThrow();
    expect(repo.get().modelId).toBe(LARGE.id);
  });
});

describe('pause, cancel and resume', () => {
  it('pause keeps the partial file and does not restart by itself', async () => {
    const config = await withBundledTools();
    await mkdir(join(t.dir, 'models'), { recursive: true });
    await writeFile(join(t.dir, 'models', `${LARGE.file}.part`), Buffer.alloc(1000));
    const { svc, repo, settings } = makeService({ config });
    await settings.setRaw('aiSubtitles', true);
    await repo.update({ modelId: LARGE.id });
    await svc.init(); // starts downloading (the setup is on)
    await waitForCalls(() => fetchCalls.some((c) => c.url === LARGE.url));

    await svc.pauseDownload();
    expect(repo.get()).toMatchObject({ paused: true, pausedModelId: LARGE.id });
    expect((await svc.status()).paused).toBe(true);
    expect((await stat(join(t.dir, 'models', `${LARGE.file}.part`))).size).toBeGreaterThanOrEqual(
      1000,
    );
  });

  it('cancel deletes the partial file and clears the pause', async () => {
    const config = await withBundledTools();
    await mkdir(join(t.dir, 'models'), { recursive: true });
    const part = join(t.dir, 'models', `${LARGE.file}.part`);
    await writeFile(part, Buffer.alloc(1000));
    const { svc, repo } = makeService({ config });
    await repo.update({ modelId: LARGE.id, paused: true, pausedModelId: LARGE.id });

    await svc.cancelDownload();
    await expect(stat(part)).rejects.toThrow();
    expect(repo.get()).toMatchObject({ paused: false, pausedModelId: undefined });
  });

  it('resume clears the pause and starts the download again', async () => {
    const config = await withBundledTools();
    const { svc, repo } = makeService({ config });
    await repo.update({ modelId: LARGE.id, paused: true, pausedModelId: LARGE.id });

    await svc.resume();
    expect(repo.get().paused).toBe(false);
    await waitForCalls(() => fetchCalls.some((c) => c.url === LARGE.url));
    expect(fetchCalls.some((c) => c.url === LARGE.url)).toBe(true);
  });

  it('does not restart a paused download at start-up', async () => {
    const config = await withBundledTools();
    const { svc, repo, settings } = makeService({ config });
    await settings.setRaw('aiSubtitles', true);
    await repo.update({ modelId: LARGE.id, paused: true });
    await svc.init();
    expect(fetchCalls).toEqual([]);
  });
});

describe('init', () => {
  it('adopts the model that the old setup script installed', async () => {
    await fakeInstall(LARGE);
    const { svc, repo } = makeService({ config: desktopConfig() });
    await svc.init();
    expect(repo.get().modelId).toBe(LARGE.id);
  });

  it('writes aiSubtitles off in the desktop app only when the setting is absent', async () => {
    const { svc, settings } = makeService({ config: desktopConfig({ desktopVersion: '0.1.0' }) });
    await svc.init();
    expect(settings.getBoolean('aiSubtitles')).toBe(false);

    await settings.setRaw('aiSubtitles', true);
    await svc.init();
    expect(settings.getBoolean('aiSubtitles')).toBe(true);
  });

  it('leaves the setting alone outside the desktop app', async () => {
    const { svc, settings } = makeService({ config: desktopConfig() });
    await svc.init();
    expect(settings.raw('aiSubtitles')).toBeUndefined();
  });
});

describe('ensureReady', () => {
  it('starts downloading the recommended model when nothing is installed', async () => {
    const config = await withBundledTools();
    const { svc } = makeService({
      config,
      hardware: { totalMemory: () => 16 * GB, cpus: () => 10 },
    });
    await svc.ensureReady();

    expect((await svc.status()).download).toMatchObject({
      status: 'downloading',
      modelId: LARGE.id,
    });
    await waitForCalls(() => fetchCalls.some((c) => c.url === LARGE.url));
    expect(fetchCalls.some((c) => c.url === LARGE.url)).toBe(true);
  });

  it('does nothing when everything is ready', async () => {
    const config = await withBundledTools();
    await fakeInstall(SMALL);
    const { svc, repo } = makeService({ config });
    await repo.update({ modelId: SMALL.id });
    await svc.ensureReady();

    expect((await svc.status()).ready).toBe(true);
    expect(fetchCalls).toEqual([]);
  });

  it('reports a problem when FFmpeg is missing', async () => {
    const config = await withBundledTools();
    const { svc } = makeService({
      config,
      whisperOverrides: { ffmpegBin: join(t.dir, 'missing', 'ffmpeg') },
    });
    await svc.ensureReady();

    expect((await svc.status()).problem).toBe(PROBLEM);
    expect(fetchCalls).toEqual([]);
  });

  it('resumes a partial file with a Range request', async () => {
    const config = await withBundledTools();
    await mkdir(join(t.dir, 'models'), { recursive: true });
    await writeFile(join(t.dir, 'models', `${LARGE.file}.part`), Buffer.alloc(1000));
    const { svc } = makeService({ config });
    await svc.ensureReady();

    await waitForCalls(() => fetchCalls.some((c) => c.url === LARGE.url));
    expect(fetchCalls.find((c) => c.url === LARGE.url)?.range).toBe('bytes=1000-');
  });

  it('selects a model that is already installed but not chosen yet', async () => {
    const config = await withBundledTools();
    await fakeInstall(SMALL);
    const { svc, repo } = makeService({ config });
    await svc.ensureReady();

    expect(repo.get().modelId).toBe(SMALL.id);
    // The speed test runs in the background after the selection; wait for it before cleanup.
    await waitForCalls(() => repo.get().speedFactor !== undefined);
    expect(engineCloses).toBeGreaterThan(0);
  });
});

describe('startup in the desktop app', () => {
  it('continues an interrupted setup when AI subtitles are on', async () => {
    const config = await withBundledTools();
    const { svc, settings } = makeService({ config });
    await settings.setRaw('aiSubtitles', true);
    await svc.init();

    await waitForCalls(() => fetchCalls.some((c) => c.url === LARGE.url));
    expect(fetchCalls.some((c) => c.url === LARGE.url)).toBe(true);
  });

  it('does not start a download when AI subtitles are off', async () => {
    const config = await withBundledTools();
    const { svc } = makeService({ config });
    await svc.init();
    expect(fetchCalls).toEqual([]);
  });
});

describe('speed test and step-down', () => {
  beforeEach(() => {
    benchCostMs = 1000;
    clockMs = 0;
  });

  it('steps down once to the small model when the model is too slow on first setup', async () => {
    const config = await withBundledTools();
    await fakeInstall(LARGE);
    const { svc, repo } = makeService({ config });
    await repo.update({ modelId: LARGE.id });
    // 10 s of processing for the 11 s sample: about 0.9 times real time, above the 0.5 limit.
    benchCostMs = 10_000;
    await svc.startBenchmark();

    await waitForCalls(() => repo.get().steppedDown === true);
    expect(repo.get()).toMatchObject({ steppedDown: true, benchmarkPending: SMALL.id });
    await waitForCalls(() => fetchCalls.some((c) => c.url === SMALL.url));
    expect(fetchCalls.some((c) => c.url === SMALL.url)).toBe(true);
  });

  it('never steps down a model the user picked in Settings', async () => {
    const config = await withBundledTools();
    await fakeInstall(LARGE);
    const { svc, repo } = makeService({ config });
    await repo.update({ modelId: LARGE.id, modelPickedByUser: true });
    benchCostMs = 10_000;
    await svc.startBenchmark();

    await waitForCalls(() => repo.get().speedFactor !== undefined);
    expect(repo.get().speedFactor).toBeGreaterThan(0.5);
    expect(repo.get().steppedDown).toBeUndefined();
    expect(fetchCalls.some((c) => c.url === SMALL.url)).toBe(false);
  });

  it('keeps the model on a fast computer and records the speed', async () => {
    const config = await withBundledTools();
    await fakeInstall(LARGE);
    const { svc, repo } = makeService({ config });
    await repo.update({ modelId: LARGE.id });
    benchCostMs = 1000;
    await svc.startBenchmark();

    await waitForCalls(() => repo.get().speedFactor !== undefined);
    expect(repo.get().steppedDown).toBeUndefined();
    expect(repo.get().variant).toBe('cpu');
    expect((await svc.status()).benchmark).toMatchObject({ status: 'done' });
  });

  it('refuses a speed test when no model is installed', async () => {
    const config = await withBundledTools();
    const { svc } = makeService({ config });
    await expect(svc.startBenchmark()).rejects.toMatchObject({ status: 400 });
  });
});

async function waitForCalls(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
