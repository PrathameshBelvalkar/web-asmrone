import type { Dispatcher } from 'undici';
import { HttpError } from '../../models/errors.js';
import type {
  MangaGallery,
  MangaIndex,
  MangaIndexQuery,
  MangaList,
  MangaListQuery,
  MangaSort,
  MangaSource,
} from '../../models/manga.js';
import { ThreehentaiClient, type ThreehentaiClientOptions } from './api/threehentai.client.js';
import { INDEX_PATH, KIND_PATH } from './constants.js';
import { parseGalleryPage, parseReaderPage } from './parsers/gallery.js';
import { parseIndexPage } from './parsers/index-page.js';
import { parseListing } from './parsers/listing.js';

const TAG_SORT: Readonly<Record<MangaSort, string | null>> = {
  new: null,
  popular: 'popular',
  '24h': 'popular-24h',
  '7d': 'popular-7d',
};

/** 3hentai.to as a manga source: builds the site's addresses and parses what comes back. */
export class ThreehentaiExtension implements MangaSource {
  private readonly client: ThreehentaiClient;

  constructor(dispatcher: Dispatcher, options: ThreehentaiClientOptions) {
    this.client = new ThreehentaiClient(dispatcher, options);
  }

  async list(query: MangaListQuery): Promise<MangaList> {
    return parseListing(await this.client.page(listAddress(query)), query.page);
  }

  async index(query: MangaIndexQuery): Promise<MangaIndex> {
    const params = new URLSearchParams();
    if (query.letter !== null) params.set('letter', query.letter);
    if (query.sort === 'popular') params.set('sort', 'popular');
    if (query.page > 1) params.set('page', String(query.page));
    const qs = params.toString();
    const html = await this.client.page(`/${INDEX_PATH[query.kind]}/${qs ? `?${qs}` : ''}`);
    return parseIndexPage(html, query.page);
  }

  async gallery(id: string): Promise<MangaGallery> {
    if (!/^\d{1,9}$/.test(id)) throw HttpError.notFound();
    const fromReader = parseReaderPage(await this.client.page(`/d/${id}/1/`));
    if (fromReader !== null) return fromReader;
    const fromInfo = parseGalleryPage(await this.client.page(`/d/${id}/`), id);
    if (fromInfo !== null) return fromInfo;
    throw HttpError.upstream(502, 'Could not read this gallery from 3hentai.to.');
  }
}

/** The site address for a list query. */
export function listAddress(query: MangaListQuery): string {
  const params = new URLSearchParams();
  let path: string;
  if (query.by === 'browse') {
    path = '/kai';
    if (query.sort === 'popular') params.set('sort', 'popular');
  } else if (query.by === 'search') {
    path = '/search/';
    params.set('q', query.q);
  } else {
    // Slugs are checked by the controller (letters, digits, `-`, `_`, `.`, `%`), so they go in as is.
    path = `/${KIND_PATH[query.by]}/${query.slug}/`;
    const sort = TAG_SORT[query.sort];
    if (sort !== null) params.set('sort', sort);
  }
  if (query.page > 1) params.set('page', String(query.page));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
