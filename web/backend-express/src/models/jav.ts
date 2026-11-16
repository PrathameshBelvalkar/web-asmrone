/**
 * JAV. A separate area from the music extensions and from manga: a movie here is metadata (covers,
 * cast, studio, genres, sample images), not something Echo plays, so it has its own port.
 */

export const JAV_KINDS = ['censored', 'uncensored'] as const;
export type JavKind = (typeof JAV_KINDS)[number];
export const isJavKind = (value: string): value is JavKind =>
  (JAV_KINDS as readonly string[]).includes(value);

/** Lists of movies that belong to one name. */
export const JAV_LIST_BY = ['genre', 'studio', 'director'] as const;
export type JavListBy = (typeof JAV_LIST_BY)[number];
export const isJavListBy = (value: string): value is JavListBy =>
  (JAV_LIST_BY as readonly string[]).includes(value);

export const JAV_MOVIE_SORTS = ['release', 'most_favorited', 'top_rated'] as const;
export type JavMovieSort = (typeof JAV_MOVIE_SORTS)[number];

export const JAV_IDOL_SORTS = ['debut', 'name', 'top_rated', 'most_favorited', 'newest'] as const;
export type JavIdolSort = (typeof JAV_IDOL_SORTS)[number];

export const JAV_NEWS_CATEGORIES = [
  'top-jav-movies',
  'new-jav-debuts',
  'top-jav-idols',
  'idol-updates',
  'site-updates',
] as const;
export type JavNewsCategory = (typeof JAV_NEWS_CATEGORIES)[number];

/** A genre, studio, director, series or category: its slug on the site and its name. */
export interface JavRef {
  readonly slug: string;
  readonly name: string;
}

export interface JavMovieCard {
  readonly slug: string;
  readonly kind: JavKind;
  /** `SAVR-1268`. Uncensored movies have none. */
  readonly dvdId: string | null;
  readonly title: string;
  /** `YYYY-MM-DD`, or null. */
  readonly releaseDate: string | null;
  /** Release date after today in Japan. Set by the service, which knows the date. */
  readonly upcoming: boolean;
  readonly cover: string | null;
  readonly studio: JavRef | null;
}

export interface JavSample {
  readonly thumb: string;
  readonly full: string;
}

export interface JavMovie extends JavMovieCard {
  readonly contentId: string | null;
  readonly coverFull: string | null;
  readonly runtimeMin: number | null;
  readonly series: JavRef | null;
  readonly director: JavRef | null;
  readonly genres: readonly JavRef[];
  readonly idols: readonly JavIdolCard[];
  readonly samples: readonly JavSample[];
  /** Trailer address on the studio's or DMM's host. The browser loads it, never the server. */
  readonly trailer: string | null;
  readonly similar: readonly JavMovieCard[];
}

export interface JavIdolCard {
  readonly slug: string;
  readonly name: string;
  readonly photo: string | null;
  readonly age: number | null;
}

export interface JavIdol extends JavIdolCard {
  readonly photoFull: string | null;
  readonly nameJapanese: string | null;
  readonly altNames: readonly string[];
  readonly dob: string | null;
  readonly debut: string | null;
  readonly debutAge: number | null;
  readonly birthplace: string | null;
  readonly sign: string | null;
  readonly blood: string | null;
  readonly measurements: string | null;
  readonly cup: string | null;
  readonly heightCm: number | null;
  readonly shoeSize: string | null;
  readonly hairLength: readonly string[];
  readonly hairColor: readonly string[];
  readonly tags: readonly string[];
  readonly bio: string | null;
  readonly censoredCount: number | null;
  readonly uncensoredCount: number | null;
  /** One page of the idol's movies. */
  readonly movies: JavList<JavMovieCard>;
  readonly related: readonly JavIdolCard[];
}

export interface JavGenreGroup {
  readonly name: string;
  readonly genres: readonly JavRef[];
}

export interface JavNewsItem {
  /** `2026/11/13/top-jav-movies-2026-week-45`: the post's address on the site, without slashes around it. */
  readonly path: string;
  readonly url: string;
  readonly title: string;
  /** `YYYY-MM-DD`, from the address. */
  readonly date: string;
  readonly categories: readonly JavRef[];
  readonly summary: string;
  readonly image: string | null;
}

export type JavRankedEntry =
  | { readonly rank: number; readonly type: 'movie'; readonly movie: JavMovieCard }
  | { readonly rank: number; readonly type: 'idol'; readonly idol: JavIdolCard };

export interface JavNewsPost {
  readonly path: string;
  readonly url: string;
  readonly title: string;
  readonly date: string;
  /** The first paragraph, as plain text. */
  readonly intro: string;
  /** The ranked list of the weekly posts. Empty for any other post. */
  readonly ranked: readonly JavRankedEntry[];
}

export interface JavList<T> {
  readonly items: readonly T[];
  readonly page: number;
  /** The last page number the site lists, or null. */
  readonly lastPage: number | null;
  readonly hasMore: boolean;
}

export interface JavMovieList extends JavList<JavMovieCard> {
  /** On a genre, studio or director list: its name, read from the page heading. */
  readonly heading: string | null;
}

export type JavMovieQuery =
  | {
      readonly by: 'all';
      readonly kind: JavKind;
      readonly sort: JavMovieSort;
      readonly page: number;
    }
  | { readonly by: JavListBy; readonly slug: string; readonly page: number }
  | {
      readonly by: 'search';
      readonly q: string;
      /** null searches both kinds. */
      readonly kind: JavKind | null;
      readonly page: number;
    };

/** Idol filters, keyed by the site's facet name without its `_` prefix. */
export const JAV_IDOL_FACETS = {
  content_type: ['censored', 'uncensored'],
  age_group: ['teen', 'twenties', 'milf', 'mature'],
  cup_size: [
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
    'q',
    's',
    't',
  ],
  body_type: [
    'big-tits',
    'slim',
    'small-tits',
    'curvy',
    'big-ass',
    'trans',
    'gal',
    'tall',
    'chubby',
    'fat',
    'athletic',
    'tattoo',
    'caucasian',
    'half-japanese',
    'foreigner',
    'twin',
    'taiwanese',
    'korean',
    'pregnant',
  ],
  hair_length: ['long', 'medium', 'short'],
  hair_color: [
    'black',
    'brown',
    'blonde',
    'red',
    'pink',
    'auburn',
    'purple',
    'blue',
    'grey',
    'silver',
  ],
} as const satisfies Record<string, readonly string[]>;
export type JavIdolFacet = keyof typeof JAV_IDOL_FACETS;

export interface JavIdolQuery {
  readonly sort: JavIdolSort;
  readonly facets: Readonly<Partial<Record<JavIdolFacet, readonly string[]>>>;
  /** Debut years, both ends included. */
  readonly debutYear: readonly [number, number] | null;
  readonly page: number;
}

/**
 * A full-movie stream (docs/JAV.md section 11). `master` is an HLS master playlist the client loads
 * through the proxy; its video segments load from their own host.
 */
export interface JavStream {
  readonly server: 'sb';
  readonly master: string;
  /** Epoch ms after which the client should ask again. */
  readonly expiresAt: number;
}

/** A source of JAV metadata. */
export interface JavSource {
  movies(query: JavMovieQuery): Promise<JavMovieList>;
  movie(kind: JavKind, slug: string): Promise<JavMovie>;
  idols(query: JavIdolQuery): Promise<JavList<JavIdolCard>>;
  searchIdols(q: string, page: number): Promise<JavList<JavIdolCard>>;
  idol(slug: string, page: number): Promise<JavIdol>;
  genres(): Promise<JavGenreGroup[]>;
  news(category: JavNewsCategory | null, page: number): Promise<JavList<JavNewsItem>>;
  newsPost(path: string): Promise<JavNewsPost>;
}
