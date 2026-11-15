import { HttpError } from '../models/errors.js';
import type {
  MangaCard,
  MangaGallery,
  MangaIndex,
  MangaIndexKind,
  MangaIndexQuery,
  MangaList,
  MangaListQuery,
  MangaSource,
  MangaTag,
} from '../models/manga.js';
import type { IssuedUrls } from '../stores/issued-urls.js';

/**
 * Content rules. Galleries with any of these tags are never shown, opened or searched for. This is a
 * fixed list, not a setting.
 */
export const BLOCKED_TAG_NAMES: readonly string[] = [
  'lolicon',
  'shotacon',
  'toddlercon',
  'low lolicon',
  'low shotacon',
  'oppai loli',
];
/** The site's ids for the tags above, found from their tag pages on 2026-11-15. */
export const BLOCKED_TAG_IDS: readonly number[] = [4, 30, 540, 10340, 3625];
/**
 * Words that name a blocked tag or a variant of one (`loli`, `lolibaba`, `shota`), matched anywhere
 * in a search, a tag name or a tag slug. `shota` followed by `r` is left alone: Shotaro is a common
 * Japanese given name.
 */
const BLOCKED_WORD = /loli|shota(?!r)|toddler/i;

/**
 * Titles that say the characters are children: school years below high school and words for young
 * children, in English, Japanese and Chinese. Tags on the site are incomplete, so titles are checked too.
 */
const BLOCKED_TITLE = new RegExp(
  [
    'loli', 'shota(?!r)', 'toddler', 'elementary school', 'grade school', 'middle school', 'junior high',
    '\\bJ[SC]\\b', '\\bchild(?:ren)?\\b', '\\bkids?\\b',
    '小学', '中学', '女子中', '男子中', '幼女', '幼児', '幼稚園', '園児', 'ロリ', 'ショタ', '児童', '初中', '萝莉', '正太',
  ].join('|'),
  'i',
);

const normalName = (name: string): string =>
  decodeSafe(name).toLowerCase().replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim();

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Manga & Doujinshi. Applies the content rules to everything the source returns, and records the
 * image addresses it hands out so the proxy can serve them.
 */
export class MangaService {
  private readonly blockedIds = new Set<number>(BLOCKED_TAG_IDS);
  private readonly blockedNames = new Set(BLOCKED_TAG_NAMES.map(normalName));

  constructor(
    private readonly source: MangaSource,
    private readonly issued: IssuedUrls,
  ) {}

  async list(query: MangaListQuery): Promise<MangaList> {
    if (query.by === 'search' && this.isBlockedQuery(query.q)) return emptyList(query.page);
    if (query.by !== 'browse' && query.by !== 'search' && this.isBlockedName(query.slug)) throw unavailable();
    const list = await this.source.list(query);
    if (list.tag !== null && this.isBlockedTag(list.tag)) throw unavailable();
    const items = list.items.filter((card) => !this.isBlockedCard(card));
    for (const card of items) {
      this.issued.add(card.cover);
      for (const url of card.coverFallbacks) this.issued.add(url);
    }
    return { ...list, items };
  }

  async index(query: MangaIndexQuery): Promise<MangaIndex> {
    const index = await this.source.index(query);
    return { ...index, items: index.items.filter((tag) => !this.isBlockedTag(tag)) };
  }

  /**
   * Tags (or artists, characters, …) whose name contains `q`. The site has no name search, and its
   * A–Z lists are split by first letter, so this reads every page of the query's first letter
   * (cached for a day after the first time) and filters them. Names that start with `q` come first,
   * then the ones with the most galleries.
   */
  async searchIndex(kind: MangaIndexKind, q: string): Promise<MangaTag[]> {
    const needle = normalName(q);
    if (needle.length === 0 || this.isBlockedQuery(needle)) return [];
    const first = needle[0] ?? '';
    const letter = /[a-z]/.test(first) ? first : '#';
    const all: MangaTag[] = [];
    let page = 1;
    let lastPage = 1;
    do {
      const index = await this.source.index({ kind, letter, sort: 'az', page });
      all.push(...index.items);
      lastPage = Math.min(index.lastPage ?? page, SEARCH_MAX_PAGES);
      page++;
    } while (page <= lastPage);
    return all
      .filter((tag) => !this.isBlockedTag(tag) && normalName(tag.name).includes(needle))
      .sort((a, b) => {
        const aStarts = normalName(a.name).startsWith(needle) ? 0 : 1;
        const bStarts = normalName(b.name).startsWith(needle) ? 0 : 1;
        return aStarts - bStarts || (b.count ?? 0) - (a.count ?? 0);
      })
      .slice(0, SEARCH_MAX_RESULTS);
  }

  async gallery(id: string): Promise<MangaGallery> {
    const gallery = await this.source.gallery(id);
    if (
      gallery.tags.some((tag) => this.isBlockedTag(tag)) ||
      BLOCKED_TITLE.test(gallery.title) ||
      BLOCKED_TITLE.test(gallery.titleJapanese ?? '') ||
      BLOCKED_TITLE.test(gallery.prettyTitle ?? '')
    ) {
      // Remember the ids of blocked tags met by name, so listings drop those cards too.
      for (const tag of gallery.tags) {
        if (tag.id !== null && this.isBlockedName(tag.name)) this.blockedIds.add(tag.id);
      }
      throw unavailable();
    }
    this.issued.add(gallery.cover);
    for (const page of gallery.pages) {
      this.issued.add(page.url);
      this.issued.add(page.thumb);
    }
    return gallery;
  }

  private isBlockedCard(card: MangaCard): boolean {
    return card.tagIds.some((id) => this.blockedIds.has(id)) || BLOCKED_TITLE.test(card.title);
  }

  private isBlockedTag(tag: MangaTag): boolean {
    if (tag.id !== null && this.blockedIds.has(tag.id)) return true;
    return this.isBlockedName(tag.name) || this.isBlockedName(tag.slug);
  }

  private isBlockedName(name: string): boolean {
    const normal = normalName(name);
    return this.blockedNames.has(normal) || BLOCKED_WORD.test(normal);
  }

  private isBlockedQuery(q: string): boolean {
    return BLOCKED_WORD.test(decodeSafe(q));
  }
}

const unavailable = (): HttpError => new HttpError(451, 'forbidden', 'This gallery is not available in Echo.');

const emptyList = (page: number): MangaList => ({ tag: null, items: [], page, lastPage: page, hasMore: false });

/** A letter of a big list (artists starting with S) runs to a dozen pages; more is never read. */
const SEARCH_MAX_PAGES = 30;
const SEARCH_MAX_RESULTS = 60;
