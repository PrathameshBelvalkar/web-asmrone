import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, stat, statfs, unlink } from 'node:fs/promises';
import { once } from 'node:events';
import { join } from 'node:path';
import { finished } from 'node:stream/promises';
import { MODELS, VAD_MODEL, type ModelEntry } from '../../config/model-catalog.js';
import { appLogger } from '../../lib/app-logger.js';
import { HttpError } from '../../models/errors.js';

export type DownloadState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'downloading';
      readonly modelId: string;
      readonly received: number;
      readonly total: number;
      readonly bytesPerSecond: number;
    }
  | { readonly status: 'verifying'; readonly modelId: string }
  | { readonly status: 'failed'; readonly modelId: string; readonly message: string };

/** Free space kept back on top of the file itself. */
const SPARE_BYTES = 200 * 1024 * 1024;
/** Waits before each retry after a dropped connection. */
const RETRY_WAITS_MS = [1000, 2000, 4000, 8000, 16000];
const SPEED_WINDOW_MS = 3000;
const COULD_NOT_FINISH =
  'Could not finish the download. Check the internet connection, then try again.';

/** A failure whose message is shown to the user as it is. */
class DownloadError extends Error {}

export interface ModelDownloadDeps {
  readonly modelsDir: string;
  readonly fetch: typeof fetch;
  /** Defaults to the catalog. Tests pass small files. */
  readonly models?: readonly ModelEntry[];
  readonly vad?: ModelEntry;
  readonly freeSpace?: (dir: string) => Promise<number>;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
  /** Runs after a model file is saved and checked (not for the VAD file). */
  readonly onInstalled?: (modelId: string) => Promise<void>;
}

interface Run {
  readonly entry: ModelEntry;
  readonly gen: number;
  readonly signal: AbortSignal;
}

interface Ctx {
  readonly modelId: string;
  readonly gen: number;
  readonly signal: AbortSignal;
}

/**
 * Downloads model files one at a time. A partial file (`<name>.part`) is kept on cancel or
 * failure and resumed by the next start. Finished files are checked against their SHA-256.
 */
export class ModelDownloadService {
  private current: DownloadState = { status: 'idle' };
  private controller: AbortController | null = null;
  /** Bumped on every start and cancel, so a stale run never changes the state. */
  private generation = 0;
  private readonly models: readonly ModelEntry[];
  private readonly vad: ModelEntry;
  private readonly freeSpace: (dir: string) => Promise<number>;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(private readonly deps: ModelDownloadDeps) {
    this.models = deps.models ?? MODELS;
    this.vad = deps.vad ?? VAD_MODEL;
    this.freeSpace = deps.freeSpace ?? freeSpaceOf;
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = deps.now ?? Date.now;
  }

  state(): DownloadState {
    return this.current;
  }

  isBusy(): boolean {
    return this.current.status === 'downloading' || this.current.status === 'verifying';
  }

  /**
   * Starts the download in the background and returns once it has started. Refuses an unknown
   * model or a second download. An installed model is left alone.
   */
  async start(modelId: string): Promise<void> {
    const entry = this.models.find((m) => m.id === modelId);
    if (!entry) throw HttpError.badRequest('Unknown model.');
    if (this.isBusy()) throw HttpError.badRequest('A download is already running.');

    // Set the state before any await, so two starts cannot both pass the check above.
    const gen = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.current = {
      status: 'downloading',
      modelId,
      received: 0,
      total: entry.size,
      bytesPerSecond: 0,
    };

    if (await isInstalled(this.deps.modelsDir, entry)) {
      if (gen === this.generation) this.finish(gen);
      return;
    }
    void this.run({ entry, gen, signal: controller.signal });
  }

  /** Stops a running download and keeps the partial file so it can be resumed. */
  cancel(): void {
    if (!this.isBusy()) return;
    this.generation++;
    this.controller?.abort();
    this.controller = null;
    this.current = { status: 'idle' };
  }

  close(): void {
    this.cancel();
  }

  private async run({ entry, gen, signal }: Run): Promise<void> {
    const ctx: Ctx = { modelId: entry.id, gen, signal };
    try {
      await mkdir(this.deps.modelsDir, { recursive: true });
      await this.checkSpace(entry);
      if (!(await isInstalled(this.deps.modelsDir, this.vad))) {
        await this.fetchFile(this.vad, { ...ctx, modelId: entry.id });
      }
      await this.fetchFile(entry, ctx);
      if (gen !== this.generation) return;
      try {
        await this.deps.onInstalled?.(entry.id);
      } catch (err) {
        appLogger().error({ err }, 'after-download step failed');
      }
      this.finish(gen);
    } catch (err) {
      // A cancelled download is not a failure. Its partial file stays.
      if (signal.aborted || gen !== this.generation) return;
      const message =
        err instanceof DownloadError ? err.message : 'The download stopped. Please try again.';
      appLogger().warn({ err, modelId: entry.id }, 'model download failed');
      this.setIfCurrent(gen, { status: 'failed', modelId: entry.id, message });
    }
  }

  private async checkSpace(entry: ModelEntry): Promise<void> {
    const remaining = entry.size - (await partLength(this.partPath(entry)));
    const needed = remaining + SPARE_BYTES;
    const free = await this.freeSpace(this.deps.modelsDir);
    if (free < needed) {
      throw new DownloadError(
        `Not enough free disk space. Needed: ${formatBytes(needed)}. Free: ${formatBytes(free)}.`,
      );
    }
  }

  /** Downloads one file with retries, then checks it and moves it into place. */
  private async fetchFile(entry: ModelEntry, ctx: Ctx): Promise<void> {
    const part = this.partPath(entry);
    for (let attempt = 0; ; attempt++) {
      try {
        await this.transfer(entry, part, ctx);
        break;
      } catch (err) {
        if (ctx.signal.aborted) throw err;
        if (err instanceof DownloadError) throw err;
        if (attempt >= RETRY_WAITS_MS.length) throw new DownloadError(COULD_NOT_FINISH);
        appLogger().warn({ err, attempt }, 'model download interrupted; retrying');
        await this.sleep(RETRY_WAITS_MS[attempt] ?? 0);
      }
    }

    this.setIfCurrent(ctx.gen, { status: 'verifying', modelId: ctx.modelId });
    const digest = await sha256(part);
    if (digest !== entry.sha256) {
      await removeFile(part);
      throw new DownloadError('The download was damaged. Please try again.');
    }
    await rename(part, join(this.deps.modelsDir, entry.file));
  }

  /** Writes the rest of the file to `part`, resuming from its current length when the server allows. */
  private async transfer(entry: ModelEntry, part: string, ctx: Ctx): Promise<void> {
    let offset = await partLength(part);
    if (offset >= entry.size) offset = await removeFile(part);

    let res = await this.request(entry.url, offset, ctx.signal);
    if (!isSuccess(res)) {
      await res.body?.cancel().catch(noop);
      if (offset === 0) throw failedAnswer(res.status);
      // 416 (the range does not fit) or another answer to a resume: start again from zero, once.
      await removeFile(part);
      offset = 0;
      res = await this.request(entry.url, 0, ctx.signal);
      if (!isSuccess(res)) {
        await res.body?.cancel().catch(noop);
        throw failedAnswer(res.status);
      }
    }

    // 206 appends to the partial file. 200 means the server ignored the range: start again.
    const resumed = res.status === 206;
    let received = resumed ? offset : 0;
    if (!res.body) throw new Error('The server sent no data.');
    const meter = new SpeedMeter(this.now);
    const out = createWriteStream(part, { flags: resumed ? 'a' : 'w' });
    const chunks = res.body as AsyncIterable<Uint8Array>;
    try {
      for await (const chunk of chunks) {
        if (!out.write(chunk)) await once(out, 'drain');
        received += chunk.byteLength;
        this.setIfCurrent(ctx.gen, {
          status: 'downloading',
          modelId: ctx.modelId,
          received,
          total: entry.size,
          bytesPerSecond: meter.add(chunk.byteLength),
        });
      }
      out.end();
      await finished(out);
    } catch (err) {
      out.end();
      await finished(out).catch(noop);
      throw err;
    }

    const size = (await stat(part)).size;
    if (size < entry.size) throw new Error('The connection ended early.');
    if (size > entry.size) {
      await removeFile(part);
      throw new DownloadError('The download was damaged. Please try again.');
    }
  }

  private request(url: string, offset: number, signal: AbortSignal): Promise<Response> {
    const headers: Record<string, string> = offset > 0 ? { Range: `bytes=${offset}-` } : {};
    return this.deps.fetch(url, { headers, signal });
  }

  private partPath(entry: ModelEntry): string {
    return join(this.deps.modelsDir, `${entry.file}.part`);
  }

  private finish(gen: number): void {
    this.setIfCurrent(gen, { status: 'idle' });
  }

  private setIfCurrent(gen: number, state: DownloadState): void {
    if (gen === this.generation) this.current = state;
  }
}

/** True when the model file is in place with the expected size. */
export async function isInstalled(modelsDir: string, entry: ModelEntry): Promise<boolean> {
  try {
    return (await stat(join(modelsDir, entry.file))).size === entry.size;
  } catch {
    return false;
  }
}

/** Bytes already in the partial file for a model (0 when there is none). */
export function partialBytes(modelsDir: string, entry: ModelEntry): Promise<number> {
  return partLength(join(modelsDir, `${entry.file}.part`));
}

/** "550 MB", "1.2 GB". Used in messages the user reads. */
export function formatBytes(bytes: number): string {
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;
  if (bytes < kb) return `${bytes} bytes`;
  if (bytes < mb) return `${Math.round(bytes / kb)} KB`;
  if (bytes < gb) return `${Math.round(bytes / mb)} MB`;
  return `${(bytes / gb).toFixed(1)} GB`;
}

/** Average bytes per second over the last few seconds. */
class SpeedMeter {
  private readonly samples: { at: number; bytes: number }[] = [];
  private readonly startedAt: number;

  constructor(private readonly now: () => number) {
    this.startedAt = now();
  }

  /** Records bytes just received and returns the average speed. */
  add(bytes: number): number {
    const at = this.now();
    this.samples.push({ at, bytes });
    while (this.samples[0] && at - this.samples[0].at > SPEED_WINDOW_MS) this.samples.shift();
    const total = this.samples.reduce((sum, s) => sum + s.bytes, 0);
    const span = Math.min(SPEED_WINDOW_MS, Math.max(1000, at - this.startedAt));
    return Math.round(total / (span / 1000));
  }
}

async function partLength(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

/** Deletes a file if it exists. Returns 0 (the length of a file that is gone). */
async function removeFile(path: string): Promise<number> {
  await unlink(path).catch(noop);
  return 0;
}

function failedAnswer(status: number): DownloadError {
  return new DownloadError(
    `The download failed (the server answered ${status}). Please try again.`,
  );
}

function isSuccess(res: Response): boolean {
  return res.status === 200 || res.status === 206;
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

/** Bytes available to this user on the disk holding `dir`. */
export async function freeSpaceOf(dir: string): Promise<number> {
  const info = await statfs(dir);
  return info.bavail * info.bsize;
}

function noop(): void {
  // Deliberately ignored: the caller is already handling the real error.
}
