import type { HanimeBrowse, HanimeSort } from '../api/types';

export const HANIME_HOME = { label: 'Hentai', to: '/hentai' };

export const titleRoute = (slug: string) => `/hentai/title/${encodeURIComponent(slug)}`;

/** The title list with the given filters and sort. Only values that differ from the defaults go in the address. */
export function browseRoute(values: Partial<Record<keyof HanimeBrowse, string>> = {}, base = '/hentai/titles'): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  const qs = params.toString();
  return `${base}${qs ? `?${qs}` : ''}`;
}
export const tagRoute = (slug: string) => browseRoute({ tags: slug });
export const studioRoute = (slug: string) => browseRoute({ studios: slug });
export const seriesRoute = (key: string) => browseRoute({ series: key, sort: 'name' });
export const searchRoute = (q: string) => browseRoute({ q }, '/hentai/search');
export const seasonsRoute = (year?: number) => `/hentai/seasons${year === undefined ? '' : `?year=${year}`}`;

/** "23:14", "1:02:05". */
export function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export const SORTS: { value: HanimeSort; label: string }[] = [
  { value: 'uploaded', label: 'New uploads' },
  { value: 'trending', label: 'Trending' },
  { value: 'views', label: 'Most viewed' },
  { value: 'likes', label: 'Most liked' },
  { value: 'rating', label: 'Top rated' },
  { value: 'released', label: 'Release date' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'name', label: 'A–Z' },
];
export const RELEVANCE = { value: 'relevance' as const, label: 'Best match' };

const isSort = (value: string | null): value is HanimeSort =>
  value === 'relevance' || SORTS.some((s) => s.value === value);
const list = (value: string | null): string[] =>
  value ? [...new Set(value.toLowerCase().split(',').filter((v) => /^[a-z0-9-]+$/.test(v)))] : [];

/** Browse's choices from the address. A search sorts by best match unless told otherwise. */
export function browseFromParams(params: URLSearchParams, search = false): HanimeBrowse {
  const q = params.get('q')?.trim() || undefined;
  const rawSort = params.get('sort');
  const sort: HanimeSort = isSort(rawSort) ? rawSort : q ? 'relevance' : 'uploaded';
  const censored = params.get('censored');
  const year = params.get('year');
  return {
    q: search || q ? q : undefined,
    tags: list(params.get('tags')),
    tagMode: params.get('tagMode') === 'or' ? 'or' : 'and',
    exclude: list(params.get('exclude')),
    studios: list(params.get('studios')),
    censored: censored === 'censored' || censored === 'uncensored' ? censored : 'all',
    year: year && /^\d{4}(?:,\d{4})?$/.test(year) ? year : undefined,
    series: params.get('series') || undefined,
    sort,
    order: params.get('order') === 'asc' ? 'asc' : params.get('order') === 'desc' ? 'desc' : sort === 'name' ? 'asc' : 'desc',
  };
}

/** The address for Browse's choices, keeping only what differs from the defaults. */
export function browseToParams(b: HanimeBrowse): URLSearchParams {
  const p = new URLSearchParams();
  if (b.q) p.set('q', b.q);
  if (b.tags.length) p.set('tags', b.tags.join(','));
  if (b.tags.length > 1 && b.tagMode === 'or') p.set('tagMode', 'or');
  if (b.exclude.length) p.set('exclude', b.exclude.join(','));
  if (b.studios.length) p.set('studios', b.studios.join(','));
  if (b.censored !== 'all') p.set('censored', b.censored);
  if (b.year) p.set('year', b.year);
  if (b.series) p.set('series', b.series);
  const defaultSort = b.q ? 'relevance' : 'uploaded';
  if (b.sort !== defaultSort) p.set('sort', b.sort);
  const defaultOrder = b.sort === 'name' ? 'asc' : 'desc';
  if (b.order !== defaultOrder) p.set('order', b.order);
  return p;
}

/** How many filters are on (each tag, studio and setting counts once). */
export function activeFilters(b: HanimeBrowse): number {
  return b.tags.length + b.exclude.length + b.studios.length + (b.censored !== 'all' ? 1 : 0) + (b.year ? 1 : 0) + (b.series ? 1 : 0);
}

/** `2026-11-17T…` → `17 Nov 2026`. */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return 'never';
  const minutes = Math.round((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** Tag names as the site writes them (`blow job`), with a capital first letter. */
export const tagLabel = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);
