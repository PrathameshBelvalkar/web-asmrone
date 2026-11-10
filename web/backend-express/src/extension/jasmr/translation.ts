import type { Extras } from '../../models/echo/common.js';
import type { Settings, Setting } from '../../models/echo/settings.js';
import { languageForCode, type TranslationLanguage } from '../asmrone/languages.js';
import { translateList } from '../asmrone/translation/translate-list.js';

/** On by default. The target is the shared "Translation Language" setting. */
export const TRANSLATE_TITLES_KEY = 'jasmrTranslateTitles';

export const TRANSLATE_TITLES_SETTING: Setting = {
  kind: 'Switch',
  title: 'Translate Japanese ASMR titles',
  summary: 'Work titles, chapter titles and descriptions, into the Translation Language',
  key: TRANSLATE_TITLES_KEY,
  defaultValue: true,
};

type TranslateList = (
  list: readonly string[],
  language: TranslationLanguage,
) => Promise<ReadonlyMap<string, string> | null>;

/** Turns site text into the user's language. Text it can't translate is returned unchanged. */
export class TitleTranslator {
  constructor(
    private readonly settings: () => Settings | null,
    private readonly translate: TranslateList = translateList,
  ) {}

  /**
   * Translates the texts in one batch and returns a lookup (original → translated). The lookup
   * returns its input when translation is off, the target is Japanese, or the request failed.
   */
  async lookup(texts: readonly string[]): Promise<(text: string) => string> {
    const target = this.target();
    const unique = [...new Set(texts.map((t) => t.trim()).filter((t) => t.length > 0))];
    if (target === null || unique.length === 0) return (text) => text;
    // Very long texts are sent as sentence-sized pieces: one request can't carry more than ~1800
    // characters, and a longer single text made the whole batch fail.
    const pieces = new Map(unique.map((text) => [text, splitLongText(text)] as const));
    const map = await this.translate([...new Set([...pieces.values()].flat())], target);
    if (map === null) return (text) => text;
    return (text) => {
      const parts = pieces.get(text.trim());
      if (parts === undefined) return text;
      const out = parts.map((part) => map.get(part));
      return out.every((part) => part !== undefined) ? out.join(' ') : text;
    };
  }

  private target(): TranslationLanguage | null {
    const settings = this.settings();
    if (settings?.getBoolean(TRANSLATE_TITLES_KEY) === false) return null;
    const language = languageForCode(settings?.getString('translationLanguage') ?? null);
    return language.code === 'ja' ? null : language;
  }
}

/** Longest piece sent for translation (the translator batches up to ~1800 characters per request). */
const MAX_PIECE_CHARS = 600;

/** Splits a long text after sentence ends (or commas, or at the limit) into pieces of at most MAX_PIECE_CHARS. */
export function splitLongText(text: string, max = MAX_PIECE_CHARS): string[] {
  if (text.length <= max) return [text];
  const sentences = text.split(/(?<=[。！？!?])/u).flatMap((sentence) => {
    if (sentence.length <= max) return [sentence];
    const out: string[] = [];
    for (let rest = sentence; rest.length > 0;) {
      if (rest.length <= max) {
        out.push(rest);
        break;
      }
      const comma = Math.max(rest.lastIndexOf('、', max), rest.lastIndexOf(' ', max));
      const cut = comma > max / 2 ? comma + 1 : max;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    return out;
  });
  const pieces: string[] = [];
  for (const sentence of sentences) {
    const last = pieces.pop();
    if (last !== undefined && last.length + sentence.length <= max) pieces.push(last + sentence);
    else pieces.push(...(last === undefined ? [] : [last]), sentence);
  }
  return pieces.map((piece) => piece.trim()).filter((piece) => piece.length > 0);
}

/** The item with its title translated; the original stays in `extras.originalTitle` (used by search). */
export function retitle<T extends { readonly title: string; readonly extras: Extras }>(
  item: T,
  translated: (text: string) => string,
): T {
  const title = translated(item.title);
  if (title === item.title) return item;
  return { ...item, title, extras: { ...item.extras, originalTitle: item.title } };
}

/** Lines of a description, so each is translated on its own and line breaks survive. */
export function descriptionLines(description: string | null): string[] {
  return (description ?? '').split('\n').filter((line) => line.trim().length > 0);
}

export function translateDescription(
  description: string | null,
  translated: (text: string) => string,
): string | null {
  if (description === null) return null;
  return description
    .split('\n')
    .map((line) => (line.trim().length > 0 ? translated(line) : line))
    .join('\n');
}
