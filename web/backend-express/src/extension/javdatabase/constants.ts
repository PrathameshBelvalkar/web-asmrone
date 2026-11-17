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

/**
 * "Only her" on an idol page: the site's Featured Actress genre marks single-actress releases. The
 * idol page filters by it (`?_genre=featured-actress`) and pages the result with `ipage`.
 */
export const SOLO_GENRE = 'featured-actress';

/**
 * Featured Actress releases whose title says they have a cast of several: "49 Women", "Omnibus",
 * "Harem", "Threesome". The site gives no cast count in its lists, so this catches the ones the
 * genre lets through. Her own best-of collections stay, since she is still alone in them.
 */
export const MULTI_CAST_TITLE =
  /\b(?:\d+\s*(?:women|girls|actresses|ladies|idols|people|performers)\b|omnibus|harem|orgy|gangbang|threesome|foursome|lesbian|co-?star(?:ring)?|all[- ]stars?|several (?:women|girls|actresses))/i;
