import { appLogger } from '../../lib/app-logger.js';
import type { TimedLine } from '../../models/ai-subtitles.js';
import type { AudioStream } from './audio-stream.js';
import { addInterval, planNextPiece, totalCovered, type Interval } from './chunk-planner.js';
import { quietestPoint } from './pcm.js';
import type { SpeechEngine } from './whisper-server.js';

export type LiveStatus =
  | {
      readonly status: 'running';
      /** `starting` until the first audio has arrived. */
      readonly phase: 'starting' | 'transcribing';
      readonly covered: readonly Interval[];
      readonly coveredMs: number;
      /** Track length when known. */
      readonly totalMs: number | null;
      readonly lines: readonly TimedLine[];
    }
  | { readonly status: 'failed'; readonly message: string; readonly lines: readonly TimedLine[] };

export interface LiveDeps<T> {
  readonly engine: SpeechEngine;
  readonly openAudio: (payload: T) => Promise<AudioStream>;
  /** Called once a track is fully transcribed. */
  readonly save: (key: string, lines: readonly TimedLine[]) => Promise<void>;
  /** Expected length before the audio has fully arrived (from track metadata). */
  readonly expectedMs: (payload: T) => number | null;
  /** Tracks kept in progress at once; the least recently asked-for is dropped beyond this. */
  readonly maxJobs?: number;
  /** A failed track is not retried until this much time has passed. */
  readonly retryAfterMs?: number;
  /** How long to wait for more audio before planning again. */
  readonly idleMs?: number;
  readonly now?: () => number;
}

interface Job<T> {
  readonly key: string;
  readonly payload: T;
  /** Higher is more recent. */
  priority: number;
  focusMs: number;
  audio: AudioStream | null;
  covered: Interval[];
  lines: TimedLine[];
  removed: boolean;
}

/**
 * Transcribes tracks piece by piece while their audio is still arriving, so lines show up within
 * seconds. One piece runs at a time. The next piece always comes from the most recently asked-for
 * track, starting where the listener is, so the track being played (asked for on every poll, with
 * its position) goes first, and skipping ahead moves the work with you.
 */
export class LiveTranscriber<T> {
  private readonly jobs = new Map<string, Job<T>>();
  private readonly failed = new Map<
    string,
    { message: string; at: number; lines: readonly TimedLine[] }
  >();
  private counter = 0;
  private looping = false;
  private wake: (() => void) | null = null;
  private idleWaiters: (() => void)[] = [];
  private closed = false;

  constructor(private readonly deps: LiveDeps<T>) {}

  /** Asks for a track (again). `focusMs` is the listening position, when known. */
  request(key: string, payload: T, focusMs: number | null): void {
    if (this.closed) return;
    const failure = this.failed.get(key);
    if (failure && this.now() - failure.at < (this.deps.retryAfterMs ?? 10 * 60_000)) return;
    this.failed.delete(key);

    let job = this.jobs.get(key);
    if (!job) {
      job = {
        key,
        payload,
        priority: 0,
        focusMs: 0,
        audio: null,
        covered: [],
        lines: [],
        removed: false,
      };
      this.jobs.set(key, job);
      // Load the model while the first audio downloads.
      this.deps.engine.warmUp?.().catch((err: unknown) => {
        appLogger().warn({ err }, 'speech engine warm-up failed');
      });
      this.openAudio(job);
      this.evictExtraJobs();
    }
    job.priority = ++this.counter;
    if (focusMs !== null && Number.isFinite(focusMs)) job.focusMs = Math.max(0, focusMs);
    this.kick();
  }

  /** Progress for a track, or null when nothing is in progress (never asked for, or finished). */
  status(key: string): LiveStatus | null {
    const job = this.jobs.get(key);
    if (job) {
      const audio = job.audio;
      const arrived = audio ? audio.availableMs() : 0;
      return {
        status: 'running',
        phase: arrived > 0 ? 'transcribing' : 'starting',
        covered: job.covered,
        coveredMs: totalCovered(job.covered),
        totalMs: audio?.isDone() && !audio.error() ? arrived : this.deps.expectedMs(job.payload),
        lines: job.lines,
      };
    }
    const failure = this.failed.get(key);
    if (failure && this.now() - failure.at < (this.deps.retryAfterMs ?? 10 * 60_000)) {
      return { status: 'failed', message: failure.message, lines: failure.lines };
    }
    return null;
  }

  /** Resolves when no track is in progress (used by tests). */
  idle(): Promise<void> {
    if (this.jobs.size === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  async close(): Promise<void> {
    this.closed = true;
    const jobs = [...this.jobs.values()];
    this.jobs.clear();
    for (const job of jobs) job.removed = true;
    this.kick();
    await Promise.all(jobs.flatMap((job) => (job.audio ? [job.audio.close()] : [])));
  }

  private openAudio(job: Job<T>): void {
    this.deps
      .openAudio(job.payload)
      .then(async (audio) => {
        if (job.removed) await audio.close();
        else job.audio = audio;
        this.kick();
      })
      .catch((err: unknown) => {
        void this.fail(job, err);
      });
  }

  private evictExtraJobs(): void {
    const max = this.deps.maxJobs ?? 3;
    const byAge = [...this.jobs.values()].sort((a, b) => a.priority - b.priority);
    while (byAge.length > max) {
      const oldest = byAge.shift();
      if (oldest) void this.remove(oldest);
    }
  }

  private kick(): void {
    this.wake?.();
    if (this.looping) return;
    this.looping = true;
    void this.loop().finally(() => {
      this.looping = false;
      const waiters = this.idleWaiters;
      this.idleWaiters = [];
      for (const resolve of waiters) resolve();
    });
  }

  private async loop(): Promise<void> {
    while (!this.closed && this.jobs.size > 0) {
      const worked = await this.step();
      if (!worked) await this.sleep(this.deps.idleMs ?? 500);
    }
  }

  /** Runs one piece (or finishes one track). False when every track is waiting for audio. */
  private async step(): Promise<boolean> {
    const jobs = [...this.jobs.values()].sort((a, b) => b.priority - a.priority);
    for (const job of jobs) {
      const audio = job.audio;
      if (!audio) continue;
      const failure = audio.error();
      if (failure && audio.availableMs() === 0) {
        await this.fail(job, failure);
        return true;
      }
      const plan = await planNextPiece({
        covered: job.covered,
        focusMs: job.focusMs,
        availableMs: audio.availableMs(),
        done: audio.isDone(),
        quietPoint: async (from, to) => quietestPoint(await audio.read(from, to), from),
      });
      if (plan.kind === 'wait') continue;
      if (plan.kind === 'complete') {
        // A download that broke part-way leaves an incomplete transcript: shown, but not saved.
        if (failure) await this.fail(job, failure);
        else await this.finish(job);
        return true;
      }
      await this.transcribePiece(job, audio, plan.piece);
      return true;
    }
    return false;
  }

  private async transcribePiece(job: Job<T>, audio: AudioStream, piece: Interval): Promise<void> {
    const pcm = await audio.read(piece.start, piece.end);
    let lines: TimedLine[];
    try {
      lines = await this.deps.engine.transcribe(pcm);
    } catch (err) {
      appLogger().warn({ err, key: job.key }, 'transcription failed, retrying once');
      try {
        lines = await this.deps.engine.transcribe(pcm);
      } catch (again) {
        await this.fail(job, again);
        return;
      }
    }
    if (job.removed) return;
    const shifted = lines.map((l) => ({
      start: piece.start + l.start,
      end: Math.min(piece.end, piece.start + Math.max(l.end, l.start + 1)),
      text: l.text,
    }));
    job.lines = [...job.lines, ...shifted].sort((a, b) => a.start - b.start);
    job.covered = addInterval(job.covered, piece);
  }

  private async finish(job: Job<T>): Promise<void> {
    try {
      await this.deps.save(job.key, job.lines);
    } catch (err) {
      await this.fail(job, err);
      return;
    }
    await this.remove(job);
  }

  private async fail(job: Job<T>, err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    appLogger().warn({ key: job.key, message }, 'AI subtitles failed');
    this.failed.set(job.key, { message, at: this.now(), lines: job.lines });
    await this.remove(job);
  }

  private async remove(job: Job<T>): Promise<void> {
    if (job.removed) return;
    job.removed = true;
    if (this.jobs.get(job.key) === job) this.jobs.delete(job.key);
    await job.audio?.close();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(done, ms);
      function done(): void {
        clearTimeout(timer);
        resolve();
      }
      this.wake = done;
    });
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }
}
