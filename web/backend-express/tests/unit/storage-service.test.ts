import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiSubtitleRepository } from '../../src/repositories/ai-subtitle.repository.js';
import { SettingsRepository } from '../../src/repositories/settings.repository.js';
import { StorageService } from '../../src/services/storage.service.js';
import { tempDir } from '../helpers/tmp.js';

let t: Awaited<ReturnType<typeof tempDir>>;
beforeEach(async () => {
  t = await tempDir();
});
afterEach(async () => {
  await t.cleanup();
});

function setup() {
  const subtitles = new AiSubtitleRepository(join(t.dir, 'ai-subtitles'));
  const settings = new SettingsRepository(join(t.dir, 'settings.json'));
  const auth = { logout: vi.fn(() => Promise.resolve()) };
  const tools = {
    leftoverPartialBytes: vi.fn(() => Promise.resolve(300)),
    removeLeftoverPartials: vi.fn(() => Promise.resolve()),
  };
  const applySettings = vi.fn();
  const svc = new StorageService({ subtitles, settings, auth, tools, applySettings });
  return { svc, subtitles, settings, auth, tools, applySettings };
}

describe('StorageService', () => {
  it('reports saved subtitles and leftover partial downloads', async () => {
    const { svc, subtitles } = setup();
    expect(await svc.usage()).toEqual({ subtitlesBytes: 0, partialBytes: 300 });
    await subtitles.put('track-1', [{ start: 0, end: 1, text: 'hi' }]);
    expect((await svc.usage()).subtitlesBytes).toBeGreaterThan(0);
  });

  it('clear cache deletes saved subtitles and leftover partials, keeping settings', async () => {
    const { svc, subtitles, settings, tools, auth } = setup();
    await subtitles.put('track-1', [{ start: 0, end: 1, text: 'hi' }]);
    await settings.setRaw('translationLanguage', 'en');

    await svc.clearCache();
    expect(await subtitles.get('track-1')).toBeNull();
    expect(tools.removeLeftoverPartials).toHaveBeenCalled();
    expect(settings.raw('translationLanguage')).toBe('en');
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('clear data resets preferences (keeping the AI subtitles switch) and logs out', async () => {
    const { svc, subtitles, settings, auth, applySettings } = setup();
    await subtitles.put('track-1', [{ start: 0, end: 1, text: 'hi' }]);
    await settings.setRaw('translationLanguage', 'en');
    await settings.setRaw('aiSubtitles', true);

    await svc.clearData();
    expect(await subtitles.get('track-1')).toBeNull();
    expect(settings.raw('translationLanguage')).toBeUndefined();
    expect(settings.raw('aiSubtitles')).toBe(true);
    expect(JSON.parse(await readFile(join(t.dir, 'settings.json'), 'utf8'))).toEqual({ aiSubtitles: true });
    expect(applySettings).toHaveBeenCalled();
    expect(auth.logout).toHaveBeenCalled();
  });

  it('clearing with no subtitles folder works', async () => {
    const { svc } = setup();
    await svc.clearCache();
    await expect(stat(join(t.dir, 'ai-subtitles'))).rejects.toThrow();
  });
});
