import type { ImageHolder, MangaIndexKind, MangaTagKind } from '../api/types';
import { MODEL_PREFIX } from '../api/types';

/** Languages the site lists galleries under (`/language/{slug}/`). */
export const MANGA_LANGUAGES: { slug: string; label: string }[] = [
  { slug: 'english', label: 'English' },
  { slug: 'japanese', label: 'Japanese' },
  { slug: 'chinese', label: 'Chinese' },
  { slug: 'korean', label: 'Korean' },
  { slug: 'spanish', label: 'Spanish' },
  { slug: 'french', label: 'French' },
  { slug: 'russian', label: 'Russian' },
  { slug: 'italian', label: 'Italian' },
  { slug: 'translated', label: 'Translated' },
];

export const MANGA_CATEGORIES: { slug: string; label: string }[] = [
  { slug: 'manga', label: 'Manga' },
  { slug: 'doujinshi', label: 'Doujinshi' },
  { slug: 'artistcg', label: 'Artist CG' },
  { slug: 'gamecg', label: 'Game CG' },
  { slug: 'western', label: 'Western' },
  { slug: 'non-h', label: 'Non-H' },
  { slug: 'imageset', label: 'Image set' },
  { slug: 'misc', label: 'Misc' },
];

/** Card flag code → short label. */
const FLAG_LABEL: Record<string, string> = {
  eng: 'EN', jpn: 'JP', zho: 'CN', chi: 'CN', kor: 'KR', spa: 'ES', fra: 'FR', rus: 'RU', ita: 'IT',
};
export const flagLabel = (code: string | null): string | null =>
  code ? (FLAG_LABEL[code] ?? code.toUpperCase()) : null;

export const KIND_LABEL: Record<MangaTagKind, { one: string; many: string }> = {
  tag: { one: 'Tag', many: 'Tags' },
  artist: { one: 'Artist', many: 'Artists' },
  character: { one: 'Character', many: 'Characters' },
  parody: { one: 'Parody', many: 'Parodies' },
  group: { one: 'Group', many: 'Groups' },
  language: { one: 'Language', many: 'Languages' },
  category: { one: 'Category', many: 'Categories' },
};

export const INDEX_KINDS: MangaIndexKind[] = ['tag', 'artist', 'character', 'parody', 'group'];

const TAG_KINDS = new Set<string>(['tag', 'artist', 'character', 'parody', 'group', 'language', 'category']);
export const isMangaTagKind = (value: string): value is MangaTagKind => TAG_KINDS.has(value);

/** A manga image as the shared image holder, so the header wash and the hero cover can use it. */
export function mangaHolder(url: string | null | undefined): ImageHolder | null {
  return url ? { type: `${MODEL_PREFIX}ImageHolder.NetworkRequestImageHolder`, request: { url, headers: {} } } : null;
}

export const galleryRoute = (id: string) => `/manga/g/${encodeURIComponent(id)}`;
export const readerRoute = (id: string, page = 1) => `/manga/g/${encodeURIComponent(id)}/read/${page}`;
export const tagRoute = (kind: MangaTagKind, slug: string) => `/manga/${kind}/${encodeURIComponent(slug)}`;

/** "21000" → "21K". */
export function formatCount(n: number | null): string {
  if (n === null) return '';
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Browse language --------------------------------------------------------------

const LANGUAGE_KEY = 'echo:manga:language';

/** The language last picked on Browse, or null for all languages. */
export function lastLanguage(): string | null {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    return value && MANGA_LANGUAGES.some((l) => l.slug === value) ? value : null;
  } catch {
    return null;
  }
}

export function saveLastLanguage(slug: string | null): void {
  try {
    if (slug) localStorage.setItem(LANGUAGE_KEY, slug);
    else localStorage.removeItem(LANGUAGE_KEY);
  } catch {
    /* not remembered; Browse still works */
  }
}

// Reading position -------------------------------------------------------------

const RESUME_KEY = 'echo:manga:resume';

function readResume(): Record<string, number> {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    const data: unknown = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? (data as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** The page you were last on in a gallery, or null. */
export function resumePage(id: string): number | null {
  const n = readResume()[id];
  return typeof n === 'number' && n > 1 ? n : null;
}

/** Remembers your page in a gallery. Keeps the 200 most recent galleries. */
export function saveResume(id: string, page: number): void {
  try {
    const data = readResume();
    delete data[id];
    data[id] = page;
    const keys = Object.keys(data);
    for (const key of keys.slice(0, Math.max(0, keys.length - 200))) delete data[key];
    localStorage.setItem(RESUME_KEY, JSON.stringify(data));
  } catch {
    /* storage can be unavailable; the reader still works */
  }
}

// Reader -----------------------------------------------------------------------

export type ReaderMode = 'single' | 'double' | 'strip';
export type ReaderFit = 'width' | 'height' | 'original';

export interface ReaderPrefs {
  mode: ReaderMode;
  fit: ReaderFit;
  rtl: boolean;
}

const PREFS_KEY = 'echo:manga:reader';
export const DEFAULT_PREFS: ReaderPrefs = { mode: 'single', fit: 'height', rtl: false };

export function loadPrefs(): ReaderPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<ReaderPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: ReaderPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* not saved; the reader still works */
  }
}

/**
 * The pages shown together at `page` (1-based). In double mode, page 1 (the cover) stands alone and
 * the rest go in pairs: 2–3, 4–5, …
 */
export function spreadAt(page: number, total: number, mode: ReaderMode): number[] {
  const p = Math.min(Math.max(page, 1), Math.max(total, 1));
  if (mode !== 'double' || p === 1) return [p];
  const first = p % 2 === 0 ? p : p - 1;
  return first + 1 <= total ? [first, first + 1] : [first];
}

/** The first page of the next (`+1`) or previous (`-1`) spread, kept within the gallery. */
export function stepPage(page: number, total: number, mode: ReaderMode, dir: 1 | -1): number {
  const spread = spreadAt(page, total, mode);
  if (dir === 1) return Math.min((spread[spread.length - 1] ?? page) + 1, total);
  const prevLast = (spread[0] ?? page) - 1;
  if (prevLast < 1) return 1;
  return spreadAt(prevLast, total, mode)[0] ?? 1;
}

/** What a key does in the reader, or null. Right-to-left swaps the arrow and A/D directions. */
export type ReaderAction = 'next' | 'prev' | 'first' | 'last' | 'fullscreen' | 'mode' | 'thumbs' | 'close';

export function readerAction(key: string, rtl: boolean): ReaderAction | null {
  const forward = rtl ? 'prev' : 'next';
  const back = rtl ? 'next' : 'prev';
  switch (key) {
    case 'ArrowRight':
    case 'd':
    case 'D':
      return forward;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return back;
    case 'PageDown':
      return 'next';
    case 'PageUp':
      return 'prev';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case 'f':
    case 'F':
      return 'fullscreen';
    case 'm':
    case 'M':
      return 'mode';
    case 't':
    case 'T':
      return 'thumbs';
    case 'Escape':
      return 'close';
    default:
      return null;
  }
}
