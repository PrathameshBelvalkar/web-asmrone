import * as cheerio from 'cheerio';
import type { HanimeCensorship, HanimeRecord } from '../../models/hanime.js';
import { BLOCKED_SERIES, HANIME_IMAGE_PREFIX, isBlockedTag, slugify } from './constants.js';
import type { RawTitle } from './schema.js';

const iso = (unix: number): string => new Date(unix * 1000).toISOString();

/** Only the site's own image host is passed on; anything else becomes an empty string. */
const image = (url: string): string => (url.startsWith(HANIME_IMAGE_PREFIX) ? url : '');

/** True when a content rule keeps the title out of NekoHub (constants.ts). */
export function isBlockedTitle(raw: RawTitle): boolean {
  return (
    BLOCKED_SERIES.test(raw.name) ||
    BLOCKED_SERIES.test(raw.search_titles) ||
    raw.tags.some(isBlockedTag)
  );
}

export function toRecord(raw: RawTitle): HanimeRecord {
  const name = raw.name.trim();
  const studio = raw.brand.trim() || 'Unknown';
  return {
    id: raw.id,
    slug: raw.slug.toLowerCase(),
    name,
    altTitles: altTitles(raw.search_titles, name),
    searchText: raw.search_titles,
    description: paragraphs(raw.description),
    poster: image(raw.poster_url),
    cover: image(raw.cover_url),
    studio: { slug: slugify(studio) || `studio-${raw.brand_id}`, name: studio },
    tags: [...new Set(raw.tags.map((t) => t.trim().toLowerCase()).filter((t) => t !== ''))],
    releasedAt: iso(raw.released_at_unix),
    uploadedAt: iso(raw.created_at_unix),
    views: raw.views,
    likes: raw.likes,
    dislikes: raw.dislikes,
    downloads: raw.downloads,
  };
}

/** The description's HTML as plain text paragraphs. */
export function paragraphs(html: string): string[] {
  if (html.trim() === '') return [];
  const $ = cheerio.load(`<div id="d">${html.replace(/<br\s*\/?>/gi, '\n')}</div>`);
  const blocks =
    $('#d p').length > 0
      ? $('#d p')
          .toArray()
          .map((p) => $(p).text())
      : [$('#d').text()];
  return blocks
    .flatMap((b) => b.split(/\n{2,}/))
    .map((b) => b.replace(/\s+/g, ' ').trim())
    .filter((b) => b !== '');
}

type Script = 'latin' | 'kana' | 'han' | 'hangul' | 'cyrillic' | 'other';

function scriptOf(token: string): Script | null {
  // Hangul first: Korean titles borrow the katakana middle dot (\u30fb).
  if (/[\uac00-\ud7af]/.test(token)) return 'hangul';
  if (/[\u3040-\u30fa\u30fc-\u30ff]/.test(token)) return 'kana';
  if (/[\u4e00-\u9fff]/.test(token)) return 'han';
  if (/[\u0400-\u04ff]/.test(token)) return 'cyrillic';
  if (/[a-z]/i.test(token)) return 'latin';
  return null;
}

/**
 * `search_titles` is every title the site has, in several languages, joined by spaces. The runs in
 * other scripts are pulled out as alternative titles (`ヤバい! -復讐・闇サイト-`, `위험해! -복수・암흑 Site-`).
 * Latin runs mix Romaji and English with no separator, so they stay in search only. One Latin word or
 * number between two words of the same script belongs to that run.
 */
export function altTitles(searchTitles: string, name: string): string[] {
  const tokens = searchTitles.split(/\s+/).filter((t) => t !== '');
  const runs: { script: Script; words: string[] }[] = [];
  let pending: string[] = [];
  for (const token of tokens) {
    const script = scriptOf(token) ?? 'other';
    const last = runs.at(-1);
    if (script === 'latin' || script === 'other') {
      if (last && last.script !== 'latin') pending.push(token);
      else if (last?.script === 'latin') last.words.push(token);
      else runs.push({ script: 'latin', words: [token] });
      continue;
    }
    // Japanese titles mix kana and kanji: treat both as one script. Only one Latin word or number may
    // sit inside a run; more means an English title came between.
    const joins = pending.length <= 1;
    if (
      last &&
      joins &&
      (last.script === script || (isJapanese(last.script) && isJapanese(script)))
    ) {
      last.words.push(...pending, token);
      if (script === 'kana') last.script = 'kana';
    } else {
      if (last && pending.length > 0 && last.script !== 'latin')
        runs.push({ script: 'latin', words: pending });
      runs.push({ script, words: [token] });
    }
    pending = [];
  }
  const seen = new Set([name.toLowerCase()]);
  const out: string[] = [];
  for (const run of runs) {
    if (run.script === 'latin') continue;
    const text = run.words.join(' ');
    if (seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
  }
  return out;
}

const isJapanese = (s: Script): boolean => s === 'kana' || s === 'han';

/** `censored` / `uncensored` from the tags; null when the site says neither. */
export function censorshipOf(tags: readonly string[]): HanimeCensorship | null {
  if (tags.includes('uncensored')) return 'uncensored';
  if (tags.includes('censored')) return 'censored';
  return null;
}

const EPISODE = /^(.*?)[\s:–-]*(?:(?:episode|ep\.?|vol\.?|part)\s*)?(\d{1,3})$/i;

/**
 * The series a title belongs to, from its name: `Ane Koi 2` → `ane koi`, episode 2. The site has no
 * series field. A name without a trailing number is a series of one.
 */
export function seriesOf(name: string): { key: string; name: string; episode: number | null } {
  const match = EPISODE.exec(name.trim());
  if (match?.[1] !== undefined && match[1].trim() !== '' && match[2] !== undefined) {
    const base = match[1].trim();
    return { key: base.toLowerCase(), name: base, episode: Number(match[2]) };
  }
  return { key: name.trim().toLowerCase(), name: name.trim(), episode: null };
}
