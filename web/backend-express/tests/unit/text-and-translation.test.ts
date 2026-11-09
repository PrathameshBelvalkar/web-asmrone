import { describe, expect, it } from 'vitest';
import { encodeKeyword, kotlinDoubleToString, parseKotlinBoolean, replaceAllLiteralIgnoreCase, compareText } from '../../src/extension/asmrone/util/text.js';
import { moveFirstGroupToEnd } from '../../src/extension/asmrone/translation/title.js';
import { splitIntoChunks } from '../../src/extension/asmrone/translation/chunking.js';
import { parseTranslation, TranslationError } from '../../src/extension/asmrone/translation/gtx-translator.js';
import { LANGUAGES, languageForCode, targetLanguages } from '../../src/extension/asmrone/languages.js';

describe('text helpers (Kotlin parity)', () => {
  it('encodeKeyword matches Java URLEncoder for the characters that differ', () => {
    expect(encodeKeyword('a b')).toBe('a%20b');
    expect(encodeKeyword("!'()~*-._")).toBe('%21%27%28%29%7E*-._');
    expect(encodeKeyword('$tag:x$')).toBe('%24tag%3Ax%24');
  });

  it('kotlinDoubleToString keeps one decimal for whole numbers', () => {
    expect(kotlinDoubleToString(4)).toBe('4.0');
    expect(kotlinDoubleToString(4.5)).toBe('4.5');
  });

  it('parseKotlinBoolean is true only for "true"', () => {
    expect(parseKotlinBoolean('true')).toBe(true);
    expect(parseKotlinBoolean('TRUE')).toBe(true);
    expect(parseKotlinBoolean('yes')).toBe(false);
  });

  it('replaceAllLiteralIgnoreCase is literal, not regex', () => {
    expect(replaceAllLiteralIgnoreCase('Foo foo (x)', 'foo', '')).toBe('  (x)');
    expect(replaceAllLiteralIgnoreCase('a.b a.b', '.', '-')).toBe('a-b a-b');
  });

  it('compareText orders by code unit', () => {
    expect(compareText('B', 'a')).toBeLessThan(0);
    expect(['b', 'A', 'a'].sort(compareText)).toEqual(['A', 'a', 'b']);
  });
});

describe('moveFirstGroupToEnd', () => {
  it('moves a leading bracketed group to the end', () => {
    expect(moveFirstGroupToEnd('[RJ123] Title')).toBe(' Title[RJ123]');
    expect(moveFirstGroupToEnd('【x】Title')).toBe('Title【x】');
  });

  it('leaves text without a leading group alone', () => {
    expect(moveFirstGroupToEnd('Title [x]')).toBe('Title [x]');
  });
});

describe('splitIntoChunks', () => {
  it('returns one chunk when everything fits in 1800 characters including separators', () => {
    expect(splitIntoChunks(['a', 'b'])).toEqual([['a', 'b']]);
    const exact = ['x'.repeat(900), 'y'.repeat(899)]; // 900 + 899 + 1 separator = 1800
    expect(splitIntoChunks(exact)).toHaveLength(1);
  });

  it('splits when the total exceeds 1800 and keeps every item in order', () => {
    const items = Array.from({ length: 10 }, (_, i) => `${i}`.repeat(400));
    const chunks = splitIntoChunks(items);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat()).toEqual(items);
    for (const chunk of chunks) {
      const length = chunk.reduce((n, s) => n + s.length, 0) + (chunk.length - 1);
      expect(length).toBeLessThanOrEqual(1800);
    }
  });

  it('keeps a single oversize item in its own chunk instead of dropping it', () => {
    const big = 'z'.repeat(2000);
    expect(splitIntoChunks(['a', big]).flat()).toEqual(['a', big]);
  });
});

describe('parseTranslation (gtx response)', () => {
  it('joins the translated segments', () => {
    const body = JSON.stringify([[["Hello ", "你好 ", null, null, 1], ["world", "世界", null, null, 1]], null, 'zh']);
    expect(parseTranslation(body)).toBe('Hello world');
  });

  it('skips segments without text (Kotlin mapNotNull)', () => {
    const body = JSON.stringify([[[null, "x"], ["kept", "y"]]]);
    expect(parseTranslation(body)).toBe('kept');
  });

  it('rejects a response that is not the expected shape', () => {
    expect(() => parseTranslation('{"error":1}')).toThrow(TranslationError);
  });
});

describe('language table (read from translator-1.1.2.jar)', () => {
  it('has 108 entries, with ITALIAN mapped to "it" and the auto entry excluded from settings', () => {
    expect(LANGUAGES).toHaveLength(108);
    expect(languageForCode('it').name).toBe('ITALIAN');
    expect(targetLanguages().some((l) => l.code === 'auto')).toBe(false);
  });

  it('falls back to English for unknown or missing codes', () => {
    expect(languageForCode('xx').code).toBe('en');
    expect(languageForCode(null).code).toBe('en');
  });
});
