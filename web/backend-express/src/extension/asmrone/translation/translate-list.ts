import { createHash } from 'node:crypto';
import { appLogger } from '../../../lib/app-logger.js';
import { LruCache } from '../../../lib/lru-cache.js';
import type { TranslationLanguage } from '../languages.js';
import { splitIntoChunks } from './chunking.js';
import { translateText } from './gtx-translator.js';

/** Translations keyed by (language, exact input list). Replaces Kotlin's hash-keyed cache. */
const cache = new LruCache<string, ReadonlyMap<string, string>>(1000);

/**
 * Translates a list of texts, keeping their order. Returns a map original → translation, or null
 * when the list could not be translated (the caller then keeps the originals). `hardFail` rethrows.
 */
export async function translateList(
  list: readonly string[],
  language: TranslationLanguage,
  hardFail = false,
): Promise<ReadonlyMap<string, string> | null> {
  try {
    return await translateListUnsafe(list, language, hardFail);
  } catch (err) {
    appLogger().warn({ err }, 'translation failed');
    if (hardFail) throw err;
    return null;
  }
}

async function translateListUnsafe(
  list: readonly string[],
  language: TranslationLanguage,
  hardFail: boolean,
): Promise<ReadonlyMap<string, string> | null> {
  if (list.length === 0) return new Map();

  const key = createHash('sha256').update(language.code).update('\u0000').update(JSON.stringify(list)).digest('hex');
  const cached = cache.get(key);
  if (cached && list.every((item) => cached.has(item))) return cached;

  const chunks = splitIntoChunks(list.map((item) => item.replace(/\n/g, ' ')));
  if (chunks.flat().length !== list.length) {
    if (hardFail) throw new Error('Chunking failed');
    return null;
  }

  const translatedChunks = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        return (await translateText(chunk.join('\n'), language)).split('\n');
      } catch (err) {
        appLogger().warn({ err }, 'translation chunk failed');
        return null;
      }
    }),
  );
  if (translatedChunks.some((chunk) => chunk === null)) {
    if (hardFail) throw new Error('Chunk failed to translate');
    return null;
  }

  const all = translatedChunks.flatMap((chunk) => chunk ?? []);
  if (all.length !== list.length) {
    if (hardFail) throw new Error('Translation count mismatch');
    return null;
  }

  const result = new Map(list.map((original, i) => [original, all[i] ?? original] as const));
  cache.set(key, result);
  return result;
}
