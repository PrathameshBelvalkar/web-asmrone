import type { Setting } from '../../models/echo/settings.js';
import { targetLanguages } from './languages.js';

export const MIRRORS = ['asmr-100', 'asmr-200', 'asmr-300'] as const;

/** The extension's settings page. Keys and defaults match the Kotlin extension. */
export function buildSettingItems(tagNames: readonly string[]): Setting[] {
  const languages = targetLanguages();
  const englishIndex = languages.findIndex((l) => l.code === 'en');
  return [
    {
      kind: 'Switch',
      title: 'Only Show Works With Subtitles',
      key: 'onlyShowSubtitled',
      defaultValue: false,
    },
    {
      kind: 'Switch',
      title: 'Auto-generate AI subtitles',
      summary: 'Transcribe tracks without lyrics on this computer with Whisper (free, works offline)',
      key: 'aiSubtitles',
      defaultValue: true,
    },
    {
      kind: 'Switch',
      title: 'Only Show SFW Works In Search',
      key: 'onlyShowSfw',
      defaultValue: false,
    },
    {
      kind: 'List',
      title: 'Site Mirror',
      key: 'siteMirror',
      entryTitles: [...MIRRORS],
      entryValues: [...MIRRORS],
      defaultEntryIndex: 0,
    },
    {
      kind: 'List',
      title: 'Translation Language',
      key: 'translationLanguage',
      entryTitles: languages.map((l) => l.name),
      entryValues: languages.map((l) => l.code),
      defaultEntryIndex: englishIndex >= 0 ? englishIndex : 0,
    },
    {
      kind: 'MultipleChoice',
      title: 'Show Tags On Home Page',
      key: 'showTags',
      entryTitles: [...tagNames],
      entryValues: [...tagNames],
      defaultEntryIndices: [],
    },
  ];
}
