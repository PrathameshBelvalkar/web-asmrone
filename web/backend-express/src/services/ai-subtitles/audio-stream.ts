import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, type WriteStream } from 'node:fs';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AudioInput } from '../../models/ai-subtitles.js';
import { bytesToMs, msToBytes, SAMPLE_RATE } from './pcm.js';

/** A track's audio, decoded to 16 kHz mono PCM in the background and readable while it arrives. */
export interface AudioStream {
  /** Milliseconds decoded so far. */
  availableMs(): number;
  /** True once decoding has stopped (finished, or failed: see `error`). */
  isDone(): boolean;
  error(): Error | null;
  /** Raw PCM for a range, clamped to what is available. */
  read(startMs: number, endMs: number): Promise<Buffer>;
  close(): Promise<void>;
}

/** ffmpeg arguments that read the input (seeking to a chapter if given) and write raw PCM to stdout. */
export function ffmpegArgs(input: AudioInput): string[] {
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin'];
  if (/^https?:/i.test(input.url))
    args.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5');
  const headers = Object.entries(input.headers);
  if (headers.length > 0) args.push('-headers', headers.map(([k, v]) => `${k}: ${v}\r\n`).join(''));
  if (input.startSec !== null && input.startSec > 0) args.push('-ss', String(input.startSec));
  if (input.endSec !== null)
    args.push('-t', String(Math.max(0, input.endSec - (input.startSec ?? 0))));
  args.push(
    '-i',
    input.url,
    '-vn',
    '-ac',
    '1',
    '-ar',
    String(SAMPLE_RATE),
    '-f',
    's16le',
    '-c:a',
    'pcm_s16le',
    'pipe:1',
  );
  return args;
}

/** Streams ffmpeg's output into a temp file; ranges are read back as soon as they are written. */
export class FfmpegAudioStream implements AudioStream {
  private flushedBytes = 0;
  private done = false;
  private failure: Error | null = null;
  private closed = false;

  private constructor(
    private readonly dir: string,
    private readonly file: string,
    private readonly child: ChildProcess,
    private readonly out: WriteStream,
  ) {}

  static async open(ffmpegBin: string, input: AudioInput): Promise<FfmpegAudioStream> {
    const dir = await mkdtemp(join(tmpdir(), 'echo-audio-'));
    const file = join(dir, 'audio.pcm');
    const out = createWriteStream(file);
    const child = spawn(ffmpegBin, ffmpegArgs(input), { stdio: ['ignore', 'pipe', 'pipe'] });
    const stream = new FfmpegAudioStream(dir, file, child, out);
    stream.attach();
    return stream;
  }

  availableMs(): number {
    return bytesToMs(this.flushedBytes);
  }

  isDone(): boolean {
    return this.done;
  }

  error(): Error | null {
    return this.failure;
  }

  async read(startMs: number, endMs: number): Promise<Buffer> {
    const start = Math.min(msToBytes(Math.max(0, startMs)), this.flushedBytes);
    const end = Math.min(msToBytes(Math.max(startMs, endMs)), this.flushedBytes);
    if (end <= start) return Buffer.alloc(0);
    const handle = await open(this.file, 'r');
    try {
      const buffer = Buffer.alloc(end - start);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (!this.done) this.child.kill('SIGKILL');
    this.out.destroy();
    await rm(this.dir, { recursive: true, force: true });
  }

  private attach(): void {
    let stderrTail = '';
    this.child.stdout?.on('data', (chunk: Buffer) => {
      // Counted only once written, so `read` never asks for bytes that are not on disk yet.
      this.out.write(chunk, () => (this.flushedBytes += chunk.length));
    });
    this.child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
      stderrTail = (stderrTail + chunk).slice(-1000);
    });
    this.child.on('error', (err) => {
      this.finish(err);
    });
    this.child.on('close', (code, signal) => {
      if (code === 0) {
        this.out.end(() => {
          this.finish(null);
        });
        return;
      }
      const why = signal ? `stopped (${signal})` : `exited with code ${code ?? '?'}`;
      const tail = stderrTail.trim().split('\n').slice(-2).join(' | ');
      this.finish(new Error(`Audio download ${why}${tail ? `: ${tail}` : ''}`));
    });
  }

  private finish(error: Error | null): void {
    if (this.done) return;
    this.failure = error;
    this.done = true;
  }
}
