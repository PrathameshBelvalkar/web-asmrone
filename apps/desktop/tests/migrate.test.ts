import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate, moveRenamedAppData } from '../src/migrate';

let root: string;
let home: string;
let dataDir: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'echo-migrate-'));
  home = join(root, 'home');
  dataDir = join(root, 'data');
  await mkdir(join(home, '.echo-web', 'models'), { recursive: true });
  await writeFile(join(home, '.echo-web', 'settings.json'), '{"a":1}');
  await writeFile(join(home, '.echo-web', 'user.json'), '{"u":1}');
  await mkdir(join(home, '.echo-web', 'ai-subtitles'), { recursive: true });
  await writeFile(join(home, '.echo-web', 'ai-subtitles', 'x.json'), '[]');
  await writeFile(join(home, '.echo-web', 'models', 'ggml-small-q5_1.bin'), 'model');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('migrate', () => {
  it('copies settings, user and subtitles, and moves the models, from the web folder', async () => {
    const result = migrate(dataDir, home);
    expect(result).toEqual({ copied: true, movedModels: 1 });
    expect(await readFile(join(dataDir, 'settings.json'), 'utf8')).toBe('{"a":1}');
    expect(await readFile(join(dataDir, 'user.json'), 'utf8')).toBe('{"u":1}');
    expect(await readFile(join(dataDir, 'ai-subtitles', 'x.json'), 'utf8')).toBe('[]');
    expect(await readFile(join(dataDir, 'models', 'ggml-small-q5_1.bin'), 'utf8')).toBe('model');
  });

  it('never deletes the old folder (models are moved out, the folder stays)', async () => {
    migrate(dataDir, home);
    expect((await readdir(join(home, '.echo-web'))).sort()).toEqual(['ai-subtitles', 'models', 'settings.json', 'user.json']);
    expect(await readdir(join(home, '.echo-web', 'models'))).toEqual([]);
  });

  it('does nothing when the new folder already has settings', async () => {
    await mkdir(dataDir, { recursive: true });
    await writeFile(join(dataDir, 'settings.json'), '{"new":true}');
    expect(migrate(dataDir, home)).toEqual({ copied: false, movedModels: 0 });
    expect(await readFile(join(dataDir, 'settings.json'), 'utf8')).toBe('{"new":true}');
  });

  it('does nothing when there is no web folder', async () => {
    expect(migrate(dataDir, join(root, 'nobody'))).toEqual({ copied: false, movedModels: 0 });
  });
});

describe('moveRenamedAppData', () => {
  it('renames the old Echo folder to the new one', async () => {
    const oldDir = join(root, 'Echo');
    await mkdir(join(oldDir, 'models'), { recursive: true });
    await writeFile(join(oldDir, 'settings.json'), '{"old":true}');
    expect(moveRenamedAppData(oldDir, dataDir)).toBe(true);
    expect(await readFile(join(dataDir, 'settings.json'), 'utf8')).toBe('{"old":true}');
    expect((await readdir(root)).includes('Echo')).toBe(false);
  });

  it('leaves both alone when the new folder already exists', async () => {
    const oldDir = join(root, 'Echo');
    await mkdir(oldDir, { recursive: true });
    await mkdir(dataDir, { recursive: true });
    expect(moveRenamedAppData(oldDir, dataDir)).toBe(false);
    expect((await readdir(root)).includes('Echo')).toBe(true);
  });

  it('does nothing when there is no old folder', () => {
    expect(moveRenamedAppData(join(root, 'Echo'), dataDir)).toBe(false);
  });
});
