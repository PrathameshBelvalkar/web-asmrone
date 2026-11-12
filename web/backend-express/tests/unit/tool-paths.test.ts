import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findExecutable } from '../../src/services/ai-subtitles/whisper-server.js';
import {
  availableVariants,
  EXE,
  ffmpegBin,
  whisperBin,
} from '../../src/services/tools/tool-paths.js';
import { tempDir } from '../helpers/tmp.js';

let t: { dir: string; cleanup: () => Promise<void> };

beforeEach(async () => {
  t = await tempDir();
});

afterEach(async () => {
  await t.cleanup();
});

async function putBinary(path: string): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, '#!/bin/sh\n');
  await chmod(path, 0o755);
}

describe('availableVariants', () => {
  it('lists the bundled builds that exist, best first', async () => {
    await putBinary(join(t.dir, 'whisper', 'cpu', `whisper-server${EXE}`));
    await putBinary(join(t.dir, 'whisper', 'vulkan', `whisper-server${EXE}`));
    expect(availableVariants(t.dir)).toEqual(['vulkan', 'cpu']);
  });

  it('lists metal first when it is present', async () => {
    await putBinary(join(t.dir, 'whisper', 'metal', `whisper-server${EXE}`));
    await putBinary(join(t.dir, 'whisper', 'cpu', `whisper-server${EXE}`));
    expect(availableVariants(t.dir)).toEqual(['metal', 'cpu']);
  });

  it('returns an empty list when the folder has no builds', () => {
    expect(availableVariants(t.dir)).toEqual([]);
  });

  it('returns system outside the desktop app', () => {
    expect(availableVariants(null)).toEqual(['system']);
  });
});

describe('whisperBin and ffmpegBin', () => {
  it('uses the fallback outside the desktop app', () => {
    expect(whisperBin(null, 'system', 'whisper-server')).toBe('whisper-server');
    expect(ffmpegBin(null, 'ffmpeg')).toBe('ffmpeg');
  });

  it('points at the bundled files inside the desktop app', () => {
    expect(whisperBin(t.dir, 'cpu', 'whisper-server')).toBe(
      join(t.dir, 'whisper', 'cpu', `whisper-server${EXE}`),
    );
    expect(ffmpegBin(t.dir, 'ffmpeg')).toBe(join(t.dir, `ffmpeg${EXE}`));
  });
});

describe('findExecutable', () => {
  it('treats a Windows-style path as a path and does not search PATH for it', async () => {
    expect(await findExecutable('C:\\x\\ffmpeg.exe')).toBeNull();
  });

  it('returns an absolute path that exists and is executable', async () => {
    const bin = join(t.dir, 'tool');
    await putBinary(bin);
    expect(await findExecutable(bin)).toBe(bin);
  });
});
