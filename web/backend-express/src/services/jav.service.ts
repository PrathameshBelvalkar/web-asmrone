import { BLOCKED_GENRES } from '../extension/javdatabase/constants.js';
import { BLOCKED_JAV_TITLE, BLOCKED_WORD } from '../lib/content-rules.js';
import { HttpError } from '../models/errors.js';
import type {
  JavGenreGroup,
  JavIdol,
  JavIdolCard,
  JavIdolQuery,
  JavKind,
  JavList,
  JavMovie,
  JavMovieCard,
  JavMovieList,
  JavMovieQuery,
  JavNewsCategory,
  JavNewsItem,
  JavNewsPost,
  JavRankedEntry,
  JavSource,
} from '../models/jav.js';
import type { IssuedUrls } from '../stores/issued-urls.js';

export interface JavServiceOptions {
  /** How long the page where released movies start is remembered. */
  readonly boundaryTtlMs: number;
  readonly now?: () => number;
}

interface Boundary {
  readonly page: number;
  readonly at: number;
}

const JAPAN_OFFSET_MS = 9 * 60 * 60_000;
/** The release list is newest first and starts with a few months of announced titles; never look further. */
const BOUNDARY_MAX_PAGE = 2_000;

const blockedGenreNames = new Set(BLOCKED_GENRES.map((slug) => slug.replace(/-/g, ' ')));
const normalName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * JAV. Applies the content rules to everything the source returns, works out which movies are
 * still to come, and records the image addresses it hands out so the proxy can serve them.
 */
export class JavService {
  /** Movies refused by genre or title, so their cards drop out of later lists too. */
  private readonly blockedMovies = new Set<string>();
  private readonly boundaries = new Map<JavKind, Boundary>();
  private readonly boundaryScans = new Map<JavKind, Promise<number>>();
  private readonly now: () => number;

  constructor(
    private readonly source: JavSource,
    private readonly issued: IssuedUrls,
    private readonly options: JavServiceOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  async movies(query: JavMovieQuery): Promise<JavMovieList> {
    if (query.by === 'search' && this.isBlockedQuery(query.q))
      return { heading: null, ...emptyList(query.page) };
    if (query.by === 'genre' && this.isBlockedGenre(query.slug)) throw unavailable();
    const list = await this.source.movies(query);
    return { ...list, items: this.allowedCards(list.items) };
  }

  /** Released movies, newest first: the release list from the page where released movies start. */
  async latest(kind: JavKind, page: number): Promise<JavList<JavMovieCard>> {
    const start = await this.boundary(kind);
    const list = await this.source.movies({
      by: 'all',
      kind,
      sort: 'release',
      page: start + page - 1,
    });
    const items = this.allowedCards(list.items).filter((card) => !card.upcoming);
    return {
      items,
      page,
      lastPage: list.lastPage === null ? null : list.lastPage - start + 1,
      hasMore: list.hasMore,
    };
  }

  /**
   * Announced movies, soonest first. The release list is newest first, so this reads it backwards
   * from the page where released movies start: page 1 is that page (or the one before it, when it
   * holds no announced movies), page 2 the one before, and so on up to the site's first page.
   */
  async upcoming(kind: JavKind, page: number): Promise<JavList<JavMovieCard>> {
    const start = await this.boundary(kind);
    const atStart = await this.source.movies({ by: 'all', kind, sort: 'release', page: start });
    const top = this.allowedCards(atStart.items).some((card) => card.upcoming) ? start : start - 1;
    const sitePage = top - page + 1;
    if (sitePage < 1) return emptyList(page);
    const list =
      sitePage === start
        ? atStart
        : await this.source.movies({ by: 'all', kind, sort: 'release', page: sitePage });
    const items = this.allowedCards(list.items)
      .filter((card) => card.upcoming)
      .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''));
    return { items, page, lastPage: Math.max(top, 1), hasMore: sitePage > 1 };
  }

  async movie(kind: JavKind, slug: string): Promise<JavMovie> {
    if (this.blockedMovies.has(`${kind}:${slug}`)) throw unavailable();
    const movie = await this.source.movie(kind, slug);
    if (
      movie.genres.some((g) => this.isBlockedGenre(g.slug)) ||
      BLOCKED_JAV_TITLE.test(movie.title)
    ) {
      this.blockedMovies.add(`${kind}:${slug}`);
      throw unavailable();
    }
    const stamped = this.stamp(movie);
    for (const url of [stamped.cover, stamped.coverFull]) this.issue(url);
    for (const sample of stamped.samples) {
      this.issue(sample.thumb);
      this.issue(sample.full);
    }
    // The trailer is not issued: the browser loads it from its host, and the proxy never fetches it.
    return {
      ...stamped,
      idols: this.issuedIdols(stamped.idols),
      similar: this.allowedCards(stamped.similar),
    };
  }

  async idols(query: JavIdolQuery): Promise<JavList<JavIdolCard>> {
    const list = await this.source.idols(query);
    return { ...list, items: this.issuedIdols(list.items) };
  }

  async searchIdols(q: string, page: number): Promise<JavList<JavIdolCard>> {
    if (this.isBlockedQuery(q)) return emptyList(page);
    const list = await this.source.searchIdols(q, page);
    return { ...list, items: this.issuedIdols(list.items) };
  }

  async idol(slug: string, page: number, solo = false): Promise<JavIdol> {
    const idol = await this.source.idol(slug, page, solo);
    this.issue(idol.photo);
    this.issue(idol.photoFull);
    return {
      ...idol,
      movies: { ...idol.movies, items: this.allowedCards(idol.movies.items) },
      related: this.issuedIdols(idol.related),
    };
  }

  async genres(): Promise<JavGenreGroup[]> {
    const groups = await this.source.genres();
    return groups
      .map((group) => ({
        ...group,
        genres: group.genres.filter((g) => !this.isBlockedGenre(g.slug)),
      }))
      .filter((group) => group.genres.length > 0);
  }

  async news(category: JavNewsCategory | null, page: number): Promise<JavList<JavNewsItem>> {
    const list = await this.source.news(category, page);
    for (const item of list.items) this.issue(item.image);
    return list;
  }

  async newsPost(path: string): Promise<JavNewsPost> {
    const post = await this.source.newsPost(path);
    const ranked: JavRankedEntry[] = [];
    for (const entry of post.ranked) {
      if (entry.type === 'idol') {
        ranked.push({ ...entry, idol: this.issuedIdols([entry.idol])[0] ?? entry.idol });
        continue;
      }
      const [movie] = this.allowedCards([entry.movie]);
      if (movie !== undefined) ranked.push({ ...entry, movie });
    }
    return { ...post, ranked };
  }

  /** Today's date in Japan, where release dates are set (`YYYY-MM-DD`). */
  today(): string {
    return new Date(this.now() + JAPAN_OFFSET_MS).toISOString().slice(0, 10);
  }

  /**
   * The first page of the release list that holds a released movie. The pages before it hold only
   * announced movies. Found by checking the page remembered last time and its neighbour, or else by
   * doubling the page number until a released movie shows up and then halving the gap; about a
   * dozen pages the first time, two after that. Pages are cached by the client.
   */
  private boundary(kind: JavKind): Promise<number> {
    const known = this.boundaries.get(kind);
    if (known !== undefined && this.now() - known.at < this.options.boundaryTtlMs)
      return Promise.resolve(known.page);
    const running = this.boundaryScans.get(kind);
    if (running !== undefined) return running;
    const scan = this.findBoundary(kind, known?.page ?? 1)
      .then((page) => {
        this.boundaries.set(kind, { page, at: this.now() });
        return page;
      })
      .finally(() => this.boundaryScans.delete(kind));
    this.boundaryScans.set(kind, scan);
    return scan;
  }

  private async findBoundary(kind: JavKind, hint: number): Promise<number> {
    const today = this.today();
    let lastPage = BOUNDARY_MAX_PAGE;
    const isPast = async (page: number): Promise<boolean> => {
      const list = await this.source.movies({ by: 'all', kind, sort: 'release', page });
      if (list.lastPage !== null) lastPage = Math.min(lastPage, list.lastPage);
      return (
        list.items.some((card) => card.releaseDate !== null && card.releaseDate <= today) ||
        !list.hasMore
      );
    };
    // `before` is a page known to hold only announced movies (0: none known); `after` one past the start.
    let before: number;
    let after: number;
    if (await isPast(hint)) {
      if (hint === 1 || !(await isPast(hint - 1))) return hint;
      before = 0;
      after = hint - 1;
    } else {
      before = hint;
      let step = 1;
      after = Math.min(hint + step, lastPage);
      while (!(await isPast(after))) {
        if (after >= lastPage) return lastPage;
        before = after;
        step *= 2;
        after = Math.min(before + step, lastPage);
      }
    }
    while (after - before > 1) {
      const mid = Math.floor((before + after) / 2);
      if (await isPast(mid)) after = mid;
      else before = mid;
    }
    return after;
  }

  /** Cards the content rules allow, marked as announced or released, with their covers issued. */
  private allowedCards(cards: readonly JavMovieCard[]): JavMovieCard[] {
    return cards
      .filter(
        (card) =>
          !this.blockedMovies.has(`${card.kind}:${card.slug}`) &&
          !BLOCKED_JAV_TITLE.test(card.title),
      )
      .map((card) => {
        this.issue(card.cover);
        return this.stamp(card);
      });
  }

  private issuedIdols(idols: readonly JavIdolCard[]): JavIdolCard[] {
    for (const idol of idols) this.issue(idol.photo);
    return [...idols];
  }

  private stamp<T extends JavMovieCard>(card: T): T {
    return { ...card, upcoming: card.releaseDate !== null && card.releaseDate > this.today() };
  }

  private issue(url: string | null): void {
    if (url !== null) this.issued.add(url);
  }

  private isBlockedGenre(slug: string): boolean {
    return BLOCKED_GENRES.includes(slug.toLowerCase()) || BLOCKED_WORD.test(slug);
  }

  /** A search that names a blocked genre, or reads like a blocked title. */
  private isBlockedQuery(q: string): boolean {
    const normal = normalName(q);
    return (
      BLOCKED_WORD.test(normal) || BLOCKED_JAV_TITLE.test(normal) || blockedGenreNames.has(normal)
    );
  }
}

const unavailable = (): HttpError =>
  new HttpError(451, 'forbidden', 'This title is not available in Echo.');

const emptyList = <T>(page: number): JavList<T> => ({
  items: [],
  page,
  lastPage: page,
  hasMore: false,
});
