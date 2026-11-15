/**
 * Manga & Doujinshi. A separate area from the music extensions: a gallery is a set of page images,
 * not an audio work, so it has its own port.
 */

export const MANGA_TAG_KINDS = ['tag', 'artist', 'character', 'parody', 'group', 'language', 'category'] as const;
export type MangaTagKind = (typeof MANGA_TAG_KINDS)[number];

/** Kinds with an A–Z index page (languages and categories are short fixed lists). */
export const MANGA_INDEX_KINDS = ['tag', 'artist', 'character', 'parody', 'group'] as const;
export type MangaIndexKind = (typeof MANGA_INDEX_KINDS)[number];

export const isMangaTagKind = (value: string): value is MangaTagKind =>
  (MANGA_TAG_KINDS as readonly string[]).includes(value);
export const isMangaIndexKind = (value: string): value is MangaIndexKind =>
  (MANGA_INDEX_KINDS as readonly string[]).includes(value);

/** `new` everywhere; `popular` on Browse; the three popular windows on tag-style pages. */
export type MangaSort = 'new' | 'popular' | '24h' | '7d';

export interface MangaCard {
  readonly id: string;
  readonly title: string;
  /** The site's flag code (`eng`, `jpn`, `zho`, …), or null. */
  readonly language: string | null;
  readonly cover: string;
  /** Other cover addresses to try, in order, when `cover` fails. */
  readonly coverFallbacks: readonly string[];
  /** Height divided by width, from the card's box. */
  readonly aspect: number | null;
  /** The site's numeric tag ids. Used for the content rules; not sent to the client. */
  readonly tagIds: readonly number[];
}

export interface MangaTag {
  readonly kind: MangaTagKind;
  readonly slug: string;
  readonly name: string;
  /** Number of galleries with the tag, or null when the page doesn't say. */
  readonly count: number | null;
  /** The site's numeric tag id, when known. */
  readonly id: number | null;
}

export interface MangaPage {
  readonly n: number;
  readonly url: string;
  readonly thumb: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface MangaGallery {
  readonly id: string;
  readonly title: string;
  readonly titleJapanese: string | null;
  readonly prettyTitle: string | null;
  readonly cover: string;
  readonly pages: readonly MangaPage[];
  readonly tags: readonly MangaTag[];
  /** ISO 8601, or null. */
  readonly uploadedAt: string | null;
  readonly scanlator: string | null;
}

export interface MangaList {
  /** On a tag, artist or other single-name list: that name, with its gallery count. */
  readonly tag: MangaTag | null;
  readonly items: readonly MangaCard[];
  readonly page: number;
  /** The last page number the site lists, or null. */
  readonly lastPage: number | null;
  readonly hasMore: boolean;
}

export interface MangaIndex {
  readonly items: readonly MangaTag[];
  readonly page: number;
  readonly lastPage: number | null;
}

export type MangaListQuery =
  | { readonly by: 'browse'; readonly sort: 'new' | 'popular'; readonly page: number }
  | { readonly by: 'search'; readonly q: string; readonly page: number }
  | { readonly by: MangaTagKind; readonly slug: string; readonly sort: MangaSort; readonly page: number };

export interface MangaIndexQuery {
  readonly kind: MangaIndexKind;
  /** `a`–`z`, `#` for numbers and symbols, or null for all. */
  readonly letter: string | null;
  readonly sort: 'az' | 'popular';
  readonly page: number;
}

/** A source of galleries. */
export interface MangaSource {
  list(query: MangaListQuery): Promise<MangaList>;
  index(query: MangaIndexQuery): Promise<MangaIndex>;
  gallery(id: string): Promise<MangaGallery>;
}
