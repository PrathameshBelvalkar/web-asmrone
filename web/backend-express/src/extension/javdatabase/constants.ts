import type { JavIdolSort, JavKind, JavListBy, JavMovieSort } from '../../models/jav.js';

/** javdatabase.com source (JAV). Used under licence from the site. */
export const JAVDATABASE_SITE = 'https://www.javdatabase.com';
/** Sent with every request. Plain, honest identity; no browser impersonation. */
export { APP_USER_AGENT } from '../threehentai/constants.js';

/**
 * Content rules. Movies with any of these genres are never listed, opened or searched for, and the
 * genres never appear in the genre browser. This is a fixed list, not a setting.
 */
export const BLOCKED_GENRES: readonly string[] = [
  'shotacon',
  'schoolgirl',
  'school',
  'school-uniform',
  'school-swimsuits',
  'sailor-uniform',
];

/** Path segment of each kind's list and movie pages (`/movies/{slug}/`, `/uncensored/{slug}/`). */
export const KIND_PATH: Readonly<Record<JavKind, string>> = {
  censored: 'movies',
  uncensored: 'uncensored',
};
export const LIST_BY_PATH: Readonly<Record<JavListBy, string>> = {
  genre: 'genres',
  studio: 'studios',
  director: 'directors',
};

/** Echo's sort → the site's `_sort_` value (null: the site's default order). */
export const MOVIE_SORT: Readonly<Record<JavMovieSort, string | null>> = {
  release: null,
  most_favorited: 'most_favorited',
  top_rated: 'top_rated',
};
/** On the idol list the site labels `oldest` as "Name"; the default is the newest debut. */
export const IDOL_SORT: Readonly<Record<JavIdolSort, string | null>> = {
  debut: null,
  name: 'oldest',
  top_rated: 'top_rated',
  most_favorited: 'most_favorited',
  newest: 'newest',
};
