/** Hanime: a catalog of hentai titles from hanime.tv, kept on this computer (docs/HANIME.md). */

/** A tag or a studio. `count` is how many titles have it, when a list asks for it. */
export interface HanimeRef {
  readonly slug: string;
  readonly name: string;
  readonly count?: number;
}

export type HanimeCensorship = 'censored' | 'uncensored';

/** One title as NekoHub keeps it: the catalog's fields, cleaned up. */
export interface HanimeRecord {
  readonly id: number;
  readonly slug: string;
  readonly name: string;
  /** The title in other languages and scripts (Japanese, Korean, Chinese, …), without the name. */
  readonly altTitles: readonly string[];
  /** Every title the site gives, in every language, for search. */
  readonly searchText: string;
  readonly description: readonly string[];
  readonly poster: string;
  readonly cover: string;
  readonly studio: HanimeRef;
  /** Tag names, as the site writes them (`blow job`). */
  readonly tags: readonly string[];
  readonly releasedAt: string;
  readonly uploadedAt: string;
  readonly views: number;
  readonly likes: number;
  readonly dislikes: number;
  readonly downloads: number;
}

/** A title on a list. */
export interface HanimeCard {
  readonly id: number;
  readonly slug: string;
  readonly name: string;
  readonly poster: string;
  readonly cover: string;
  readonly studio: HanimeRef;
  readonly releasedAt: string;
  readonly uploadedAt: string;
  readonly views: number;
  readonly likes: number;
  readonly censorship: HanimeCensorship | null;
  readonly episode: number | null;
  /** Uploaded in the last 7 days. */
  readonly isNew: boolean;
}

export interface HanimeTitle extends HanimeCard {
  readonly altTitles: readonly string[];
  readonly description: readonly string[];
  readonly tags: readonly HanimeRef[];
  readonly dislikes: number;
  readonly downloads: number;
  /** likes ÷ (likes + dislikes), or null without votes. */
  readonly rating: number | null;
  readonly series: { readonly key: string; readonly name: string } | null;
  readonly episodes: readonly HanimeCard[];
  readonly similar: readonly HanimeCard[];
  readonly siteUrl: string;
}

export interface HanimeList<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly lastPage: number;
  readonly total: number;
  readonly hasMore: boolean;
}

export interface HanimeShelf {
  readonly key: string;
  readonly title: string;
  /** Where "See all" goes: Browse query values. */
  readonly browse: Readonly<Record<string, string>>;
  readonly items: readonly HanimeCard[];
}

/** A tag on the Browse page: its count, and the site's one-line description and picture. */
export interface HanimeTagRef extends HanimeRef {
  readonly description: string | null;
  readonly image: string | null;
}

export interface HanimeTagGroup {
  readonly group: string;
  readonly tags: readonly HanimeTagRef[];
}

/** The sprite the Preview frames are cut from: `columns` × `rows` frames, the first `tiles` used. */
export interface HanimeStoryboard {
  readonly url: string;
  readonly columns: number;
  readonly rows: number;
  readonly tiles: number;
}

/** What only the title's page on the site has (read when the title is opened). */
export interface HanimeDetails {
  readonly durationSec: number | null;
  /** `FHD 1080p`, `23 min`, `Sub EN`, `Dub JP`. */
  readonly badges: readonly string[];
  readonly altNames: readonly string[];
  readonly synopsis: readonly string[];
  readonly storyboard: HanimeStoryboard | null;
}

export type HanimeSeasonName = 'Winter' | 'Spring' | 'Summer' | 'Fall';

/** One year's releases by season, newest season first. */
export interface HanimeSeasons {
  readonly years: readonly number[];
  readonly year: number;
  readonly seasons: readonly {
    readonly season: HanimeSeasonName;
    readonly items: readonly HanimeCard[];
  }[];
}

export type HanimeSuggestion =
  | { readonly type: 'title'; readonly card: HanimeCard }
  | {
      readonly type: 'series';
      readonly key: string;
      readonly name: string;
      readonly count: number;
      readonly poster: string;
    }
  | { readonly type: 'tag'; readonly ref: HanimeRef }
  | { readonly type: 'studio'; readonly ref: HanimeRef };

export type HanimeChangeKind = 'added' | 'updated' | 'removed';

export interface HanimeChange {
  readonly at: string;
  readonly kind: HanimeChangeKind;
  readonly id: number;
  readonly slug: string;
  readonly name: string;
  readonly poster: string;
  /** For `updated`: which fields changed. */
  readonly fields?: readonly string[];
}

export interface HanimeStatus {
  readonly titles: number;
  readonly lastCheckedAt: string | null;
  readonly lastChangedAt: string | null;
  readonly syncing: boolean;
  readonly paused: boolean;
  readonly error: string | null;
}

/** What one sync changed, as the live event sends it. */
export interface HanimeSyncResult {
  readonly added: number;
  readonly updated: number;
  readonly removed: number;
  readonly at: string;
}

export const HANIME_SORTS = [
  'uploaded',
  'released',
  'views',
  'likes',
  'rating',
  'downloads',
  'trending',
  'name',
  'relevance',
] as const;
export type HanimeSort = (typeof HANIME_SORTS)[number];

export const isHanimeSort = (value: unknown): value is HanimeSort =>
  typeof value === 'string' && (HANIME_SORTS as readonly string[]).includes(value);

export interface HanimeQuery {
  readonly q?: string;
  /** Tag slugs. */
  readonly tags: readonly string[];
  readonly tagMode: 'and' | 'or';
  readonly exclude: readonly string[];
  /** Studio slugs. */
  readonly studios: readonly string[];
  readonly censorship: HanimeCensorship | null;
  readonly years: readonly [number, number] | null;
  readonly series?: string;
  readonly sort: HanimeSort;
  readonly order: 'asc' | 'desc';
  readonly page: number;
  readonly size: number;
}

/** A title's video on hentaibros.net (docs/HANIME.md section 12). */
export interface HanimeStream {
  /** The MP4 (or HLS playlist) the browser plays from its host. */
  readonly file: string;
  /** The episode page it was read from. */
  readonly page: string;
  /** The page's heading. */
  readonly title: string;
}
