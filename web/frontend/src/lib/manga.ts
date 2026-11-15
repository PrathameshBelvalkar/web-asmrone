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
/**
 * How two pages sit side by side. `auto` lays Japanese manga out right to left (the earlier page on
 * the right, as printed) and Western comics left to right. Turning always goes right = next.
 */
export type ReaderDirection = 'auto' | 'ltr' | 'rtl';
export type ReaderBackground = 'black' | 'gray' | 'white';

export interface ReaderPrefs {
  mode: ReaderMode;
  fit: ReaderFit;
  direction: ReaderDirection;
  /** Two pages: the first page (the cover) stands alone, so the printed pairs line up. */
  coverAlone: boolean;
  background: ReaderBackground;
  /** Long strip: a small gap between pages. */
  stripGap: boolean;
}

const PREFS_KEY = 'echo:manga:reader';
export const DEFAULT_PREFS: ReaderPrefs = {
  mode: 'single',
  fit: 'height',
  direction: 'auto',
  coverAlone: true,
  background: 'black',
  stripGap: false,
};

export function loadPrefs(): ReaderPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const saved = JSON.parse(raw) as Partial<ReaderPrefs> & { rtl?: boolean };
    // Older saves had a right-to-left switch instead of a direction.
    const direction = saved.direction ?? (saved.rtl ? 'rtl' : DEFAULT_PREFS.direction);
    const { rtl: _old, ...rest } = saved;
    return { ...DEFAULT_PREFS, ...rest, direction };
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
 * Right to left unless the gallery is a Western comic. Japanese manga and doujinshi (and their
 * translations, which keep the Japanese page order) read right to left.
 */
export function autoRtl(tags: { kind: string; slug: string }[]): boolean {
  return !tags.some((t) => t.kind === 'category' && t.slug === 'western');
}

export function isRtl(direction: ReaderDirection, tags: { kind: string; slug: string }[]): boolean {
  return direction === 'auto' ? autoRtl(tags) : direction === 'rtl';
}

/** A page wider than it is tall: a two-page spread scanned as one image. */
export function isWide(page: { width: number | null; height: number | null }): boolean {
  return !!page.width && !!page.height && page.width > page.height * 1.1;
}

/**
 * The groups of pages shown together, in reading order (page numbers from 1). Single page and long
 * strip show one page at a time. Two pages pairs them, with the cover alone when `coverAlone` is on,
 * and any wide page (a spread scanned as one image) alone; the page before a lone wide page is
 * then alone too, as in the printed book.
 */
export function buildSpreads(
  pages: { width: number | null; height: number | null }[],
  mode: ReaderMode,
  coverAlone: boolean,
): number[][] {
  if (mode !== 'double') return pages.map((_, i) => [i + 1]);
  const spreads: number[][] = [];
  let pending: number[] = [];
  const flush = () => {
    if (pending.length) spreads.push(pending);
    pending = [];
  };
  pages.forEach((page, i) => {
    const n = i + 1;
    if ((n === 1 && coverAlone) || isWide(page)) {
      flush();
      spreads.push([n]);
      return;
    }
    pending.push(n);
    if (pending.length === 2) flush();
  });
  flush();
  return spreads;
}

/** Index of the spread holding `page`; pages outside the gallery go to the first or last spread. */
export function spreadIndexOf(spreads: number[][], page: number): number {
  const i = spreads.findIndex((s) => s.includes(page));
  if (i >= 0) return i;
  return page < 1 ? 0 : Math.max(spreads.length - 1, 0);
}

/**
 * What a key does in the reader, or null. → and D always go forward, also when two pages are laid
 * out right to left: the direction only changes which page sits on which side.
 */
export type ReaderAction = 'next' | 'prev' | 'first' | 'last' | 'fullscreen' | 'mode' | 'thumbs' | 'settings' | 'close';

export function readerAction(key: string): ReaderAction | null {
  switch (key) {
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'next';
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'prev';
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
    case 's':
    case 'S':
      return 'settings';
    case 'Escape':
      return 'close';
    default:
      return null;
  }
}
