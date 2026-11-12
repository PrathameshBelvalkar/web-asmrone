import { readFile } from 'node:fs/promises';
import type { Clock } from '../../lib/clock.js';
import type { SpeechEngine } from '../ai-subtitles/whisper-server.js';
import type { Variant } from './tool-paths.js';

export interface BenchmarkState {
  readonly status: 'idle' | 'running' | 'done' | 'failed';
  readonly speedFactor: number | null;
  readonly message: string | null;
}

/** One engine build to try, best first. */
export interface Candidate {
  readonly variant: Variant;
  readonly binary: string;
}

export interface BenchmarkResult extends Candidate {
  /** Seconds of processing per second of audio. Lower is faster. */
  readonly speedFactor: number;
}

/** Above this, a build is too slow to use, so the next one is tried. */
const TOO_SLOW = 2;
/** The WAV header is 44 bytes; the rest is 16 kHz mono 16-bit PCM (32 000 bytes per second). */
const WAV_HEADER_BYTES = 44;
const PCM_BYTES_PER_SECOND = 32_000;

export interface BenchmarkDeps {
  /** 16 kHz mono WAV used as the test input. */
  readonly sample: string;
  /** A speech engine for one build and one model file. */
  readonly engineFor: (binary: string, modelPath: string) => SpeechEngine;
  readonly clock: Clock;
}

/** Times a model on each engine build, falling back when a build fails or is too slow. */
export class BenchmarkService {
  private current: BenchmarkState = { status: 'idle', speedFactor: null, message: null };

  constructor(private readonly deps: BenchmarkDeps) {}

  state(): BenchmarkState {
    return this.current;
  }

  isRunning(): boolean {
    return this.current.status === 'running';
  }

  /**
   * Returns the first build that runs at a usable speed. Failing that, the fastest build that
   * ran at all. Returns null when no build could run; `state()` then holds the reason.
   */
  async run(modelPath: string, candidates: readonly Candidate[]): Promise<BenchmarkResult | null> {
    this.current = { status: 'running', speedFactor: null, message: null };
    let lastError = 'no subtitle engine was found';
    const measured: BenchmarkResult[] = [];
    try {
      const pcm = (await readFile(this.deps.sample)).subarray(WAV_HEADER_BYTES);
      const audioSeconds = pcm.length / PCM_BYTES_PER_SECOND;
      for (const candidate of candidates) {
        const engine = this.deps.engineFor(candidate.binary, modelPath);
        try {
          await engine.warmUp?.();
          const started = this.deps.clock.now();
          await engine.transcribe(pcm);
          const seconds = (this.deps.clock.now() - started) / 1000;
          const result: BenchmarkResult = { ...candidate, speedFactor: seconds / audioSeconds };
          measured.push(result);
          if (result.speedFactor <= TOO_SLOW) break;
          lastError = `${candidate.variant} ran at ${result.speedFactor.toFixed(1)} times real time`;
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'unknown error';
        } finally {
          await engine.close();
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'unknown error';
    }

    const best = measured.reduce<BenchmarkResult | null>(
      (fastest, r) => (fastest === null || r.speedFactor < fastest.speedFactor ? r : fastest),
      null,
    );
    if (!best) {
      this.current = {
        status: 'failed',
        speedFactor: null,
        message: `This computer could not run the subtitle engine. Details: ${lastError}`,
      };
      return null;
    }
    this.current = { status: 'done', speedFactor: best.speedFactor, message: null };
    return best;
  }
}
