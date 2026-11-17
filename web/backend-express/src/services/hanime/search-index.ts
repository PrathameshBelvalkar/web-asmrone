/**
 * Search over the catalog in memory (docs/HANIME.md, section 7). About 3,500 titles: each query
 * looks at every title, which takes about a millisecond, so there is no inverted index to keep.
 */

/** Lower-case, full-width → normal, accents removed, punctuation → spaces. */
export function normalise(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Japanese, Chinese and Korean: no spaces between words, so these are matched anywhere. */
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;

/** One field of a title, ready for matching. */
export interface Field {
  readonly words: readonly string[];
  /** The text without spaces, for CJK matching. */
  readonly compact: string;
}

export function field(text: string): Field {
  const norm = normalise(text);
  return { words: norm === '' ? [] : norm.split(' '), compact: norm.replace(/ /g, '') };
}

/** The query's words. */
export function queryTokens(q: string): string[] {
  const norm = normalise(q);
  return norm === '' ? [] : norm.split(' ');
}

/** A Latin word matches the start of a word; a CJK word matches anywhere. */
export function fieldHas(f: Field, token: string): boolean {
  if (CJK.test(token)) return f.compact.includes(token);
  return f.words.some((w) => w.startsWith(token));
}

export interface Searchable {
  readonly name: Field;
  /** Other-language titles and the studio. */
  readonly other: Field;
  readonly tags: Field;
  readonly nameNorm: string;
  readonly slug: string;
  readonly views: number;
}

/**
 * How well a title matches, or 0 when some word of the query matches nowhere. A word found in the
 * name counts most, then other titles and the studio, then the tags. The whole name being the query,
 * or starting with it, counts above everything else.
 */
export function score(item: Searchable, tokens: readonly string[], qNorm: string): number {
  if (tokens.length === 0) return 0;
  let total = 0;
  for (const token of tokens) {
    if (fieldHas(item.name, token)) total += 300;
    else if (fieldHas(item.other, token)) total += 200;
    else if (fieldHas(item.tags, token)) total += 100;
    else return 0;
  }
  if (item.nameNorm === qNorm || item.slug === qNorm.replace(/ /g, '-')) total += 2000;
  else if (item.nameNorm.startsWith(qNorm)) total += 1000;
  return total;
}
