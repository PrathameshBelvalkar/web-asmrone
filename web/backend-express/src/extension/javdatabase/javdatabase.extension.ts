import type { Dispatcher } from 'undici';
import { HttpError } from '../../models/errors.js';
import type {
  JavGenreGroup,
  JavIdol,
  JavIdolCard,
  JavIdolQuery,
  JavKind,
  JavList,
  JavMovie,
  JavMovieList,
  JavMovieQuery,
  JavNewsCategory,
  JavNewsItem,
  JavNewsPost,
  JavSource,
} from '../../models/jav.js';
import { JavdatabaseClient, type JavdatabaseClientOptions } from './api/javdatabase.client.js';
import {
  IDOL_SORT,
  KIND_PATH,
  LIST_BY_PATH,
  MOVIE_SORT,
  MULTI_CAST_TITLE,
  SOLO_GENRE,
} from './constants.js';
import { parseIdolList, parseMovieList } from './parsers/cards.js';
import { parseGenresPage, parseIdolPage, parseMoviePage } from './parsers/details.js';
import { parseNewsList, parseNewsPost } from './parsers/news.js';

/** javdatabase.com as a JAV source: builds the site's addresses and parses what comes back. */
export class JavdatabaseExtension implements JavSource {
  private readonly client: JavdatabaseClient;

  constructor(dispatcher: Dispatcher, options: JavdatabaseClientOptions) {
    this.client = new JavdatabaseClient(dispatcher, options);
  }

  async movies(query: JavMovieQuery): Promise<JavMovieList> {
    return parseMovieList(await this.client.page(movieListAddress(query)), query.page);
  }

  async movie(kind: JavKind, slug: string): Promise<JavMovie> {
    return parseMoviePage(await this.client.page(`/${KIND_PATH[kind]}/${slug}/`), kind, slug);
  }

  async idols(query: JavIdolQuery): Promise<JavList<JavIdolCard>> {
    return parseIdolList(await this.client.page(idolListAddress(query)), query.page);
  }

  async searchIdols(q: string, page: number): Promise<JavList<JavIdolCard>> {
    return parseIdolList(await this.client.page(searchAddress(q, 'idols', page)), page);
  }

  async idol(slug: string, page: number, solo = false): Promise<JavIdol> {
    const idol = parseIdolPage(await this.client.page(idolAddress(slug, page, solo)), slug, page);
    if (!solo) {
      if (idol.photoFull === null && idol.movies.items.length === 0) throw HttpError.notFound();
      return idol;
    }
    // Filtered, an empty page only means she has no solo movies.
    const items = idol.movies.items.filter((m) => !MULTI_CAST_TITLE.test(m.title));
    return { ...idol, movies: { ...idol.movies, items } };
  }

  async genres(): Promise<JavGenreGroup[]> {
    const groups = parseGenresPage(await this.client.page('/genres/'));
    if (groups.length === 0)
      throw HttpError.upstream(502, 'Could not read the genres from javdatabase.com.');
    return groups;
  }

  async news(category: JavNewsCategory | null, page: number): Promise<JavList<JavNewsItem>> {
    const address =
      category === null
        ? `/blog/${page > 1 ? `?paged=${page}` : ''}`
        : `/category/${category}/${page > 1 ? `page/${page}/` : ''}`;
    return parseNewsList(await this.client.page(address), page);
  }

  async newsPost(path: string): Promise<JavNewsPost> {
    return parseNewsPost(await this.client.page(`/${path}/`), path);
  }
}

/** `/page/N/` for page 2 on; nothing for page 1. */
const pagePart = (page: number): string => (page > 1 ? `page/${page}/` : '');

function searchAddress(q: string, postType: string, page: number): string {
  const params = new URLSearchParams({ s: q, post_type: postType });
  return `/${pagePart(page)}?${params.toString()}`;
}

/** The site address for a movie list query. */
export function movieListAddress(query: JavMovieQuery): string {
  if (query.by === 'search') {
    return searchAddress(
      query.q,
      query.kind === null ? 'movies,uncensored' : KIND_PATH[query.kind],
      query.page,
    );
  }
  if (query.by === 'all') {
    const sort = MOVIE_SORT[query.sort];
    const path = `/${KIND_PATH[query.kind]}/${pagePart(query.page)}`;
    return sort === null ? path : `${path}?_sort_=${sort}`;
  }
  // Slugs are checked by the controller (letters, digits, `-`, `_`, `.`, `%`), so they go in as is.
  return `/${LIST_BY_PATH[query.by]}/${query.slug}/${pagePart(query.page)}`;
}

/** An idol's page; with `solo`, filtered to her Featured Actress movies. */
export function idolAddress(slug: string, page: number, solo: boolean): string {
  const parts: string[] = [];
  if (solo) parts.push(`_genre=${SOLO_GENRE}`);
  if (page > 1) parts.push(`ipage=${page}`);
  return `/idols/${slug}/${parts.length > 0 ? `?${parts.join('&')}` : ''}`;
}

/** The site address for an idol list query. Facet values were checked against the allow-list. */
export function idolListAddress(query: JavIdolQuery): string {
  const parts: string[] = [];
  for (const [facet, values] of Object.entries(query.facets)) {
    if (values.length > 0) parts.push(`_${facet}=${values.join('%2C')}`);
  }
  if (query.debutYear !== null)
    parts.push(`_debut_year=${query.debutYear[0]}.00%2C${query.debutYear[1]}.00`);
  const sort = IDOL_SORT[query.sort];
  if (sort !== null) parts.push(`_sort_=${sort}`);
  const path = `/idols/${pagePart(query.page)}`;
  return parts.length > 0 ? `${path}?${parts.join('&')}` : path;
}
