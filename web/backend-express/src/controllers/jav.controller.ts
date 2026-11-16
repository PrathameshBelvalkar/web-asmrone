import type { Request, Response } from 'express';
import { HttpError } from '../models/errors.js';
import {
  JAV_IDOL_FACETS,
  JAV_IDOL_SORTS,
  JAV_MOVIE_SORTS,
  JAV_NEWS_CATEGORIES,
  isJavKind,
  isJavListBy,
  type JavIdolFacet,
  type JavIdolSort,
  type JavKind,
  type JavMovieSort,
  type JavNewsCategory,
} from '../models/jav.js';
import type { JavService } from '../services/jav.service.js';
import {
  javGenresView,
  javIdolListView,
  javIdolView,
  javMovieCardsView,
  javMovieListView,
  javMovieView,
  javNewsListView,
  javNewsPostView,
} from '../views/jav.view.js';
import { paramString, queryString } from './query.js';

const SLUG = /^[a-z0-9][a-z0-9%._-]{0,199}$/i;

/** Echo's idol filter names → the site's facet names. */
const FACET_PARAMS: Readonly<Record<string, JavIdolFacet>> = {
  content: 'content_type',
  age: 'age_group',
  cup: 'cup_size',
  body: 'body_type',
  hairLength: 'hair_length',
  hairColor: 'hair_color',
};

/** JAV: news, latest and upcoming movies, movie lists, movies, idols, genres and search. */
export class JavController {
  constructor(private readonly jav: JavService) {}

  news = async (req: Request, res: Response): Promise<void> => {
    const raw = queryString(req, 'category') ?? 'all';
    if (raw !== 'all' && !(JAV_NEWS_CATEGORIES as readonly string[]).includes(raw)) {
      throw HttpError.badRequest(`category must be one of: all, ${JAV_NEWS_CATEGORIES.join(', ')}`);
    }
    const category = raw === 'all' ? null : (raw as JavNewsCategory);
    res.json(javNewsListView(await this.jav.news(category, pageParam(req))));
  };

  newsPost = async (req: Request, res: Response): Promise<void> => {
    const [yyyy, mm, dd, slug] = ['yyyy', 'mm', 'dd', 'slug'].map((name) => paramString(req, name));
    if (
      !/^\d{4}$/.test(yyyy ?? '') ||
      !/^\d{2}$/.test(mm ?? '') ||
      !/^\d{2}$/.test(dd ?? '') ||
      !SLUG.test(slug ?? '')
    ) {
      throw HttpError.notFound();
    }
    res.json(javNewsPostView(await this.jav.newsPost(`${yyyy}/${mm}/${dd}/${slug}`)));
  };

  latest = async (req: Request, res: Response): Promise<void> => {
    res.json(javMovieCardsView(await this.jav.latest(kindParam(req), pageParam(req))));
  };

  upcoming = async (req: Request, res: Response): Promise<void> => {
    res.json(javMovieCardsView(await this.jav.upcoming(kindParam(req), pageParam(req))));
  };

  movies = async (req: Request, res: Response): Promise<void> => {
    const raw = queryString(req, 'sort') ?? 'release';
    if (!(JAV_MOVIE_SORTS as readonly string[]).includes(raw)) {
      throw HttpError.badRequest(`sort must be one of: ${JAV_MOVIE_SORTS.join(', ')}`);
    }
    const query = {
      by: 'all' as const,
      kind: kindParam(req),
      sort: raw as JavMovieSort,
      page: pageParam(req),
    };
    res.json(javMovieListView(await this.jav.movies(query)));
  };

  moviesBy = async (req: Request, res: Response): Promise<void> => {
    const by = paramString(req, 'by');
    const slug = paramString(req, 'slug');
    if (!isJavListBy(by)) throw HttpError.notFound();
    if (!SLUG.test(slug)) throw HttpError.badRequest('slug is not valid');
    res.json(javMovieListView(await this.jav.movies({ by, slug, page: pageParam(req) })));
  };

  movie = async (req: Request, res: Response): Promise<void> => {
    const kind = paramString(req, 'kind');
    const slug = paramString(req, 'slug');
    if (!isJavKind(kind) || !SLUG.test(slug)) throw HttpError.notFound();
    res.json(javMovieView(await this.jav.movie(kind, slug)));
  };

  idols = async (req: Request, res: Response): Promise<void> => {
    const rawSort = queryString(req, 'sort') ?? 'debut';
    if (!(JAV_IDOL_SORTS as readonly string[]).includes(rawSort)) {
      throw HttpError.badRequest(`sort must be one of: ${JAV_IDOL_SORTS.join(', ')}`);
    }
    const facets: Partial<Record<JavIdolFacet, string[]>> = {};
    for (const [param, facet] of Object.entries(FACET_PARAMS)) {
      const raw = queryString(req, param);
      if (raw === undefined || raw === '') continue;
      const values = [...new Set(raw.toLowerCase().split(','))];
      const allowed: readonly string[] = JAV_IDOL_FACETS[facet];
      const bad = values.find((v) => !allowed.includes(v));
      if (bad !== undefined) throw HttpError.badRequest(`${param} does not accept "${bad}"`);
      facets[facet] = values;
    }
    const list = await this.jav.idols({
      sort: rawSort as JavIdolSort,
      facets,
      debutYear: yearRange(queryString(req, 'debutYear')),
      page: pageParam(req),
    });
    res.json(javIdolListView(list));
  };

  idol = async (req: Request, res: Response): Promise<void> => {
    const slug = paramString(req, 'slug');
    if (!SLUG.test(slug)) throw HttpError.notFound();
    res.json(javIdolView(await this.jav.idol(slug, pageParam(req))));
  };

  genres = async (_req: Request, res: Response): Promise<void> => {
    res.json(javGenresView(await this.jav.genres()));
  };

  search = async (req: Request, res: Response): Promise<void> => {
    const q = (queryString(req, 'q') ?? '').trim();
    if (q.length === 0) throw HttpError.badRequest('q is required');
    if (q.length > 200) throw HttpError.badRequest('q is too long');
    const type = queryString(req, 'type') ?? 'movies';
    const page = pageParam(req);
    if (type === 'idols') res.json(javIdolListView(await this.jav.searchIdols(q, page)));
    else if (type === 'movies')
      res.json(javMovieListView(await this.jav.movies({ by: 'search', q, page })));
    else throw HttpError.badRequest('type must be movies or idols');
  };
}

/** `kind` query value: `censored` (default) or `uncensored`. */
function kindParam(req: Request): JavKind {
  const raw = queryString(req, 'kind') ?? 'censored';
  if (!isJavKind(raw)) throw HttpError.badRequest('kind must be censored or uncensored');
  return raw;
}

/** `2020-2026` or `2024` → both ends, in order; null when absent. */
function yearRange(raw: string | undefined): [number, number] | null {
  if (raw === undefined || raw === '') return null;
  const match = /^(\d{4})(?:-(\d{4}))?$/.exec(raw);
  if (!match) throw HttpError.badRequest('debutYear must look like 2024 or 2020-2026');
  const a = Number(match[1]);
  const b = Number(match[2] ?? match[1]);
  return a <= b ? [a, b] : [b, a];
}

/** `page` query value: a whole number from 1, default 1. */
function pageParam(req: Request): number {
  const raw = queryString(req, 'page');
  if (raw === undefined) return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 999_999)
    throw HttpError.badRequest('page must be a whole number from 1');
  return n;
}
