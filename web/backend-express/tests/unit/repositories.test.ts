import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SettingsRepository } from '../../src/repositories/settings.repository.js';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { tempDir } from '../helpers/tmp.js';

let dir = '';
let cleanup: () => Promise<void> = () => Promise.resolve();

beforeEach(async () => {
  const t = await tempDir();
  dir = t.dir;
  cleanup = t.cleanup;
});

afterEach(async () => {
  await cleanup();
});

describe('SettingsRepository (settings.json, Kotlin-compatible)', () => {
  it('writes pretty JSON with 4-space indent and no trailing newline', async () => {
    const file = join(dir, 'settings.json');
    const repo = new SettingsRepository(file);
    await repo.setRaw('onlyShowSfw', true);
    const text = await readFile(file, 'utf8');
    expect(text).toBe('{\n    "onlyShowSfw": true\n}');
  });

  it('reads an existing Kotlin-written file', async () => {
    const file = join(dir, 'settings.json');
    await writeFile(file, '{\n    "siteMirror": "asmr-300",\n    "onlyShowSfw": true\n}');
    const repo = new SettingsRepository(file);
    expect(repo.getString('siteMirror')).toBe('asmr-300');
    expect(repo.getBoolean('onlyShowSfw')).toBe(true);
  });

  it('treats a missing or corrupt file as empty', async () => {
    expect(new SettingsRepository(join(dir, 'missing.json')).getString('x')).toBeNull();
    const file = join(dir, 'bad.json');
    await writeFile(file, '{not json');
    expect(new SettingsRepository(file).getString('x')).toBeNull();
  });

  it('typed getters return null for the wrong type', async () => {
    const repo = new SettingsRepository(join(dir, 's.json'));
    await repo.setRaw('list', ['a', 'b']);
    await repo.setRaw('flag', true);
    expect(repo.getString('list')).toBeNull();
    expect(repo.getInt('flag')).toBeNull();
    expect(repo.getBoolean('list')).toBeNull();
    expect(repo.getStringSet('list')).toEqual(new Set(['a', 'b']));
    expect(repo.getStringSet('flag')).toBeNull();
  });

  it('a null value removes the key', async () => {
    const repo = new SettingsRepository(join(dir, 's.json'));
    await repo.setRaw('k', 'v');
    expect(repo.getString('k')).toBe('v');
    await repo.setRaw('k', null);
    expect(repo.getString('k')).toBeNull();
  });

  it('persists across instances', async () => {
    const file = join(dir, 's.json');
    await new SettingsRepository(file).setRaw('siteMirror', 'asmr-200');
    expect(new SettingsRepository(file).getString('siteMirror')).toBe('asmr-200');
  });

  it('putStringSet writes an array', async () => {
    const file = join(dir, 's.json');
    new SettingsRepository(file).putStringSet('showTags', new Set(['x', 'y']));
    await new Promise((r) => setTimeout(r, 50));
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ showTags: ['x', 'y'] });
  });
});

describe('UserRepository (user.json)', () => {
  it('saves, loads and clears the user', async () => {
    const repo = new UserRepository(join(dir, 'user.json'));
    expect(await repo.load()).toBeNull();
    await repo.save({ id: 'u1', name: 'Name', cover: null, subtitle: null, extras: { token: 't' } });
    const loaded = await repo.load();
    expect(loaded?.id).toBe('u1');
    expect(loaded?.extras).toEqual({ token: 't' });
    await repo.clear();
    expect(await repo.load()).toBeNull();
  });

  it('ignores unknown keys and treats a broken file as no user', async () => {
    const file = join(dir, 'user.json');
    await writeFile(file, JSON.stringify({ id: 'u', name: 'n', extra: 1 }));
    expect((await new UserRepository(file).load())?.id).toBe('u');
    await writeFile(file, '[]');
    expect(await new UserRepository(file).load()).toBeNull();
  });
});
