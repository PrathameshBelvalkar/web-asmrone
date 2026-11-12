import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SpeechEngine } from '../../src/services/ai-subtitles/whisper-server.js';
import { BenchmarkService, type Candidate } from '../../src/services/tools/benchmark.service.js';
import { tempDir } from '../helpers/tmp.js';

/** Two seconds of 16 kHz mono 16-bit audio after a 44-byte header. */
const AUDIO_SECONDS = 2;
const pcm = Buffer.alloc(AUDIO_SECONDS * 32_000, 1);

let t: { dir: string; cleanup: () => Promise<void> };
let sample: string;
let clockMs: number;
let closes: string[];

/**
 * A fake engine per binary. `cost` is how many milliseconds a transcription takes (it moves the
 * fake clock), or 'throw' for a build that cannot start.
 */
function fakeEngines(costs: Record<string, number | 'throw'>) {
  return (binary: string): SpeechEngine => ({
    unavailableReason: () => Promise.resolve(null),
    transcribe: () => {
      const cost = costs[binary];
      if (cost === 'throw' || cost === undefined) {
        return Promise.reject(new Error(`${binary} would not start`));
      }
      clockMs += cost;
      return Promise.resolve([]);
    },
    close: () => {
      closes.push(binary);
      return Promise.resolve();
    },
  });
}

const CLOCK = { now: () => clockMs };
const metal: Candidate = { variant: 'metal', binary: 'metal-bin' };
const vulkan: Candidate = { variant: 'vulkan', binary: 'vulkan-bin' };
const cpu: Candidate = { variant: 'cpu', binary: 'cpu-bin' };

function service(costs: Record<string, number | 'throw'>): BenchmarkService {
  return new BenchmarkService({ sample, engineFor: fakeEngines(costs), clock: CLOCK });
}

beforeEach(async () => {
  t = await tempDir();
  sample = join(t.dir, 'sample.wav');
  await writeFile(sample, Buffer.concat([Buffer.alloc(44), pcm]));
  clockMs = 0;
  closes = [];
});

afterEach(async () => {
  await t.cleanup();
});

describe('BenchmarkService', () => {
  it('uses the next build when the first one cannot start', async () => {
    const bench = service({ 'metal-bin': 'throw', 'cpu-bin': 1000 });
    const result = await bench.run('model.bin', [metal, cpu]);

    expect(result).toMatchObject({ variant: 'cpu', binary: 'cpu-bin' });
    expect(result?.speedFactor).toBeCloseTo(0.5);
    expect(bench.state()).toEqual({
      status: 'done',
      speedFactor: result?.speedFactor,
      message: null,
    });
  });

  it('reports failure with the last error when no build can run', async () => {
    const bench = service({ 'metal-bin': 'throw', 'vulkan-bin': 'throw', 'cpu-bin': 'throw' });
    const result = await bench.run('model.bin', [metal, vulkan, cpu]);

    expect(result).toBeNull();
    expect(bench.state()).toEqual({
      status: 'failed',
      speedFactor: null,
      message: 'This computer could not run the subtitle engine. Details: cpu-bin would not start',
    });
  });

  it('computes the speed factor from the time taken and the audio length', async () => {
    const bench = service({ 'metal-bin': 4000 });
    const result = await bench.run('model.bin', [metal]);
    // 4 s of processing for 2 s of audio.
    expect(result?.speedFactor).toBeCloseTo(2);
  });

  it('stops at the first build that is fast enough and does not try the rest', async () => {
    const bench = service({ 'metal-bin': 500, 'cpu-bin': 100 });
    const result = await bench.run('model.bin', [metal, cpu]);
    expect(result?.variant).toBe('metal');
  });

  it('tries the next build when one is too slow, and keeps the faster of the two', async () => {
    const bench = service({ 'metal-bin': 6000, 'cpu-bin': 3000 });
    const result = await bench.run('model.bin', [metal, cpu]);
    expect(result?.variant).toBe('cpu');
    expect(result?.speedFactor).toBeCloseTo(1.5);
  });

  it('uses the fastest build measured when every build is too slow', async () => {
    const bench = service({ 'metal-bin': 9000, 'cpu-bin': 5000 });
    const result = await bench.run('model.bin', [metal, cpu]);
    expect(result?.variant).toBe('cpu');
    expect(bench.state().status).toBe('done');
  });

  it('closes every engine it opens', async () => {
    const bench = service({ 'metal-bin': 'throw', 'cpu-bin': 1000 });
    await bench.run('model.bin', [metal, cpu]);
    expect(closes).toEqual(['metal-bin', 'cpu-bin']);
  });
});
