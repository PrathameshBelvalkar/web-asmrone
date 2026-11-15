import type { Request, Response } from 'express';
import { HttpError } from '../models/errors.js';
import { isMangaIndexKind, isMangaTagKind, type MangaSort } from '../models/manga.js';
import type { MangaService } from '../services/manga.service.js';
import { mangaGalleryView, mangaIndexView, mangaListView, mangaTagsView } from '../views/manga.view.js';
import { paramString, queryString } from './query.js';

const SLUG = /^[a-z0-9%._-]{1,200}$/i;
const TAG_SORTS = new Set<MangaSort>(['new', '24h', '7d', 'popular']);

/** Manga & Doujinshi: lists, search, A–Z indexes and galleries. */
export class MangaController {
  constructor(private readonly manga: MangaService) {}

  browse = async (req: Request, res: Response): Promise<void> => {
    const sort = queryString(req, 'sort') === 'popular' ? 'popular' : 'new';
    res.json(mangaListView(await this.manga.list({ by: 'browse', sort, page: pageParam(req) })));
  };

  search = async (req: Request, res: Response): Promise<void> => {
    const q = (queryString(req, 'q') ?? '').trim();
    if (q.length === 0) throw HttpError.badRequest('q is required');
    if (q.length > 200) throw HttpError.badRequest('q is too long');
    res.json(mangaListView(await this.manga.list({ by: 'search', q, page: pageParam(req) })));
  };

  byTag = async (req: Request, res: Response): Promise<void> => {
    const kind = paramString(req, 'kind');
    const slug = paramString(req, 'slug');
    if (!isMangaTagKind(kind)) throw HttpError.notFound();
    if (!SLUG.test(slug)) throw HttpError.badRequest('slug is not valid');
    const raw = queryString(req, 'sort') ?? 'new';
    const sort: MangaSort = TAG_SORTS.has(raw as MangaSort) ? (raw as MangaSort) : 'new';
    res.json(mangaListView(await this.manga.list({ by: kind, slug, sort, page: pageParam(req) })));
  };

  index = async (req: Request, res: Response): Promise<void> => {
    const kind = paramString(req, 'kind');
    if (!isMangaIndexKind(kind)) throw HttpError.notFound();
    const rawLetter = (queryString(req, 'letter') ?? '').toLowerCase();
    const letter = /^(?:[a-z]|#)$/.test(rawLetter) ? rawLetter : null;
    const sort = queryString(req, 'sort') === 'popular' ? 'popular' : 'az';
    res.json(mangaIndexView(await this.manga.index({ kind, letter, sort, page: pageParam(req) })));
  };

  indexSearch = async (req: Request, res: Response): Promise<void> => {
    const kind = paramString(req, 'kind');
    if (!isMangaIndexKind(kind)) throw HttpError.notFound();
    const q = (queryString(req, 'q') ?? '').trim();
    if (q.length === 0) throw HttpError.badRequest('q is required');
    if (q.length > 100) throw HttpError.badRequest('q is too long');
    res.json(mangaTagsView(await this.manga.searchIndex(kind, q)));
  };

  gallery = async (req: Request, res: Response): Promise<void> => {
    const id = paramString(req, 'id');
    if (!/^\d{1,9}$/.test(id)) throw HttpError.notFound();
    res.json(mangaGalleryView(await this.manga.gallery(id)));
  };
}

/** `page` query value: a whole number from 1, default 1. */
function pageParam(req: Request): number {
  const raw = queryString(req, 'page');
  if (raw === undefined) return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 999_999) throw HttpError.badRequest('page must be a whole number from 1');
  return n;
}
