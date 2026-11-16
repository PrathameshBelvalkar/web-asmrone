import type { JavIdolFilters, JavKind, JavListBy, JavNewsCategory } from '../api/types';

export const JAV_HOME = { label: 'JAV', to: '/jav' };

export const movieRoute = (kind: JavKind, slug: string) => `/jav/movie/${kind}/${encodeURIComponent(slug)}`;
export const idolRoute = (slug: string) => `/jav/idol/${encodeURIComponent(slug)}`;
export const listRoute = (by: JavListBy, slug: string) => `/jav/movies/${by}/${encodeURIComponent(slug)}`;
/** The Search page for `q`; a movie search can be kept to one kind. */
export function searchRoute(q: string, type: 'movies' | 'idols', kind?: JavKind): string {
  const params = new URLSearchParams({ q });
  if (type === 'idols') params.set('type', 'idols');
  if (type === 'movies' && kind === 'uncensored') params.set('kind', 'uncensored');
  return `/jav/search?${params.toString()}`;
}
/** A news post inside Echo. `path` is `2026/11/13/slug`. */
export const newsRoute = (path: string) => `/jav/news/${path}`;

export const LIST_BY_LABEL: Record<JavListBy, string> = { genre: 'Genre', studio: 'Studio', director: 'Director' };
export const isJavListBy = (value: string): value is JavListBy => value in LIST_BY_LABEL;
export const isJavKind = (value: string): value is JavKind => value === 'censored' || value === 'uncensored';

export const NEWS_CATEGORIES: { value: JavNewsCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'top-jav-movies', label: 'Top movies' },
  { value: 'new-jav-debuts', label: 'New debuts' },
  { value: 'top-jav-idols', label: 'Top idols' },
  { value: 'idol-updates', label: 'Idol updates' },
  { value: 'site-updates', label: 'Site updates' },
];

/**
 * The idol filters and their values, in the order the sheet shows them. The site's `loli` body type
 * is left out on purpose (a content rule), and the server refuses it.
 */
export const IDOL_FILTERS: { key: Exclude<keyof JavIdolFilters, 'debutYear'>; label: string; values: { value: string; label: string }[] }[] = [
  { key: 'content', label: 'Content', values: [opt('censored'), opt('uncensored')] },
  { key: 'age', label: 'Age group', values: [opt('teen', 'Teen (18–19)'), opt('twenties'), opt('milf', 'MILF'), opt('mature')] },
  {
    key: 'cup',
    label: 'Cup',
    values: 'abcdefghijklmnopqst'.split('').map((c) => opt(c, c.toUpperCase())),
  },
  {
    key: 'body',
    label: 'Body type',
    values: [
      'big-tits', 'slim', 'small-tits', 'curvy', 'big-ass', 'trans', 'gal', 'tall', 'chubby', 'fat', 'athletic',
      'tattoo', 'caucasian', 'half-japanese', 'foreigner', 'twin', 'taiwanese', 'korean', 'pregnant',
    ].map((v) => opt(v)),
  },
  { key: 'hairLength', label: 'Hair length', values: ['long', 'medium', 'short'].map((v) => opt(v)) },
  {
    key: 'hairColor',
    label: 'Hair colour',
    values: ['black', 'brown', 'blonde', 'red', 'pink', 'auburn', 'purple', 'blue', 'grey', 'silver'].map((v) => opt(v)),
  },
];

function opt(value: string, label?: string): { value: string; label: string } {
  return { value, label: label ?? value[0]!.toUpperCase() + value.slice(1).replace(/-/g, ' ') };
}

/** The label of one filter value, for the active-filter chips. */
export function filterValueLabel(key: keyof JavIdolFilters, value: string): string {
  return IDOL_FILTERS.find((f) => f.key === key)?.values.find((v) => v.value === value)?.label ?? value;
}

/** Idol filters from the address (`?age=twenties&cup=d,e&debutYear=2024-2026`). Unknown values are dropped. */
export function filtersFromParams(params: URLSearchParams): JavIdolFilters {
  const filters: JavIdolFilters = {};
  for (const f of IDOL_FILTERS) {
    const allowed = new Set(f.values.map((v) => v.value));
    const values = (params.get(f.key) ?? '').split(',').filter((v) => allowed.has(v));
    if (values.length > 0) filters[f.key] = values;
  }
  const year = params.get('debutYear');
  if (year && /^\d{4}(?:-\d{4})?$/.test(year)) filters.debutYear = year;
  return filters;
}

/** `2026-12-19` → "19 Dec 2026", in the reader's locale. */
export function formatDate(date: string | null): string {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Days from today until a release date, at least 0. */
export function daysUntil(date: string | null, now = new Date()): number | null {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86_400_000));
}

/**
 * A search that looks like a DVD ID (`SAVR-1268`, `savr1268`) → the movie's slug (`savr-1268`), or
 * null. Censored movie pages are named after their DVD ID.
 */
export function dvdIdSlug(q: string): string | null {
  const match = /^\s*([a-z]{2,6})-?(\d{2,5})\s*$/i.exec(q);
  return match ? `${match[1]!.toLowerCase()}-${match[2]}` : null;
}
