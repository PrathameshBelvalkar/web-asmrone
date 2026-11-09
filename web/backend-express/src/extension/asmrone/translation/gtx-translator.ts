import { Agent, request, type Dispatcher } from 'undici';
import type { TranslationLanguage } from '../languages.js';

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const DT_PARAMS = ['at', 'bd', 'ex', 'ld', 'md', 'qca', 'rw', 'rm', 'ss', 't'] as const;

let dispatcher: Dispatcher = new Agent({ connect: { timeout: 10_000 }, headersTimeout: 10_000, bodyTimeout: 10_000 });

/** Replaces the HTTP dispatcher (tests use a mock agent). */
export function configureTranslator(options: { dispatcher: Dispatcher }): void {
  dispatcher = options.dispatcher;
}

export class TranslationError extends Error {}

/** Translates one text block with the unofficial Google "gtx" endpoint. Throws on any failure. */
export async function translateText(text: string, target: TranslationLanguage): Promise<string> {
  if (target.code === 'auto') throw new TypeError('The target language cannot be auto');
  const url = new URL(ENDPOINT);
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', target.code);
  url.searchParams.set('hl', target.code);
  for (const dt of DT_PARAMS) url.searchParams.append('dt', dt);
  url.searchParams.set('ie', 'UTF-8');
  url.searchParams.set('oe', 'UTF-8');
  url.searchParams.set('otf', '1');
  url.searchParams.set('ssel', '0');
  url.searchParams.set('tsel', '0');
  url.searchParams.set('tk', 'bushissocool');
  url.searchParams.set('q', text);

  const res = await request(url, {
    method: 'GET',
    headers: { 'user-agent': USER_AGENT },
    dispatcher,
  });
  const body = await res.body.text();
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new TranslationError(`Error caught from HTTP request: ${res.statusCode}`);
  }
  return parseTranslation(body);
}

/**
 * Response shape: [[[translatedSegment, originalSegment, ...], ...], ...]. String segments are
 * concatenated. Segments without a string (null translations) are skipped, as in Kotlin mapNotNull.
 */
export function parseTranslation(body: string): string {
  const json: unknown = JSON.parse(body);
  if (!Array.isArray(json) || !Array.isArray(json[0])) {
    throw new TranslationError('Unexpected translation response');
  }
  return (json[0] as unknown[])
    .flatMap((segment) => (Array.isArray(segment) && typeof segment[0] === 'string' ? [segment[0]] : []))
    .join('');
}
