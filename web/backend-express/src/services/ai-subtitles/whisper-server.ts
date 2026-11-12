import { spawn, type ChildProcess } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { createServer } from 'node:net';
import { availableParallelism } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';
import { z } from 'zod';
import type { WhisperConfig } from '../../config/env.js';
import { appLogger } from '../../lib/app-logger.js';
import type { TimedLine } from '../../models/ai-subtitles.js';
import { wavFromPcm } from './pcm.js';

/** Speech-to-text for short pieces of audio. */
export interface SpeechEngine {
  /** Why it can't run (missing program or model), or null when it can. */
  unavailableReason(): Promise<string | null>;
  /** Lines in a piece of 16 kHz mono PCM; times are relative to the start of the piece. */
  transcribe(pcm: Buffer): Promise<TimedLine[]>;
  /** Gets ready (e.g. loads the model) ahead of the first piece. */
  warmUp?(): Promise<void>;
  close(): Promise<void>;
}

export const SETUP_HINT =
  'Run `brew install whisper-cpp ffmpeg`, then `npm run setup:whisper` in web/backend-express.';
export const DESKTOP_SETUP_HINT = 'Open Settings → AI subtitles to finish setup.';
const START_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 3 * 60_000;

const responseSchema = z.object({
  segments: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })).default([]),
});

/**
 * whisper.cpp's `whisper-server`, started on first use on a free local port. The model stays loaded
 * between requests, so each piece of audio only pays for transcription. Restarted if it exits.
 */
export class WhisperServerEngine implements SpeechEngine {
  private child: ChildProcess | null = null;
  private baseUrl: Promise<string> | null = null;

  /** `getConfig` is read on every use, so the binary and model can change at run time. */
  constructor(
    private readonly getConfig: () => WhisperConfig,
    private readonly options: { readonly setupHint: string },
  ) {}

  async unavailableReason(): Promise<string | null> {
    const config = this.getConfig();
    if (!(await findExecutable(config.whisperServerBin)))
      return `whisper-server was not found. ${this.options.setupHint}`;
    if (!(await findExecutable(config.ffmpegBin)))
      return `ffmpeg was not found. ${this.options.setupHint}`;
    if (!(await readable(config.model)))
      return `The Whisper model is missing (${config.model}). ${this.options.setupHint}`;
    return null;
  }

  async transcribe(pcm: Buffer): Promise<TimedLine[]> {
    if (pcm.length === 0) return [];
    const url = await this.ensureStarted();
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(wavFromPcm(pcm))], { type: 'audio/wav' }),
      'piece.wav',
    );
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');
    const res = await fetch(`${url}/inference`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`whisper-server answered ${res.status}: ${text.slice(0, 200)}`);
    const parsed = responseSchema.parse(JSON.parse(text));
    return parsed.segments.map((s) => ({
      start: Math.round(s.start * 1000),
      end: Math.round(s.end * 1000),
      text: s.text.trim(),
    }));
  }

  async warmUp(): Promise<void> {
    await this.ensureStarted();
  }

  close(): Promise<void> {
    this.child?.kill('SIGTERM');
    this.child = null;
    this.baseUrl = null;
    return Promise.resolve();
  }

  private ensureStarted(): Promise<string> {
    this.baseUrl ??= this.start().catch((err: unknown) => {
      this.baseUrl = null;
      throw err;
    });
    return this.baseUrl;
  }

  private async start(): Promise<string> {
    const config = this.getConfig();
    const bin = (await findExecutable(config.whisperServerBin)) ?? config.whisperServerBin;
    const port = await freePort();
    const args = [
      '-m',
      config.model,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '-l',
      'ja',
      '-t',
      String(Math.min(8, availableParallelism())),
      // No text context between windows: stops one mistake from repeating.
      '-mc',
      '0',
      '-sns',
      // No language probabilities in replies: computing them on a piece with no speech (silence,
      // common in ASMR) crashes whisper-server ("unknown language id -2").
      '-nlp',
    ];
    if (await readable(config.vadModel)) args.push('--vad', '-vm', config.vadModel);

    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    this.child = child;
    // Never outlive this process (it holds the model in memory), even when it exits without close().
    const killOnExit = (): void => {
      child.kill('SIGKILL');
    };
    process.once('exit', killOnExit);
    let stderrTail = '';
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderrTail = (stderrTail + chunk).slice(-1000);
    });
    // Set from the process callbacks while the loop below waits.
    const state = { exited: false };
    child.on('error', () => (state.exited = true));
    child.on('exit', (code) => {
      state.exited = true;
      process.removeListener('exit', killOnExit);
      if (this.child === child) {
        this.child = null;
        this.baseUrl = null;
        appLogger().warn({ code }, 'whisper-server exited');
      }
    });

    const url = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + START_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (state.exited)
        throw new Error(
          `whisper-server failed to start: ${stderrTail.trim().split('\n').slice(-2).join(' | ')}`,
        );
      try {
        // It loads the model before listening, so any answer means it is ready.
        await fetch(url, { signal: AbortSignal.timeout(1000) });
        appLogger().info({ port }, 'whisper-server ready');
        return url;
      } catch {
        // not listening yet
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    child.kill('SIGKILL');
    throw new Error('whisper-server did not start in time');
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

/**
 * Full path of a program given as a path or a name on PATH (plus Homebrew's folders, which a
 * GUI-launched shell may not have). Null when it can't be found.
 */
export async function findExecutable(bin: string): Promise<string | null> {
  // A path (including a Windows path with backslashes) is checked as it is, not searched on PATH.
  if (isAbsolute(bin) || bin.includes('/') || bin.includes('\\'))
    return (await canRun(bin)) ? bin : null;
  const dirs = [
    ...(process.env.PATH ?? '').split(delimiter),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ];
  for (const dir of dirs) {
    const path = join(dir, bin);
    if (dir && (await canRun(path))) return path;
  }
  return null;
}

async function canRun(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function readable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
