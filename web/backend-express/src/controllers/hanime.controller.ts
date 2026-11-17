import type { Request, Response } from 'express';
import { HttpError } from '../models/errors.js';
import { isHanimeSort, type HanimeQuery } from '../models/hanime.js';
import type { HanimeService } from '../services/hanime.service.js';
import type { HanimeSyncService } from '../services/hanime/sync.service.js';
import {
  hanimeCardView,
  hanimeChangesView,
  hanimeDetailsView,
  hanimeHomeView,
  hanimeListView,
  hanimeRefsView,
  hanimeSeasonsView,
  hanimeStatusView,
  hanimeSuggestView,
  hanimeTagsView,
  hanimeTitleView,
} from '../views/hanime.view.js';
import { paramString, queryString } from './query.js';

const SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/i;
const SLUG_LIST = /^[a-z0-9-]+(?:,[a-z0-9-]+)*$/;
/** A comment line every so often keeps the event stream open through idle timeouts. */
const KEEP_ALIVE_MS = 25_000;

/** Hanime: Home, Browse (filters and sorts), titles, tags, studios, suggestions, changes and sync. */
export class HanimeController {
  constructor(
    private readonly hanime: HanimeService,
    private readonly sync: HanimeSyncService,
  ) {}

  home = async (_req: Request, res: Response): Promise<void> => {
    res.json(hanimeHomeView(await this.hanime.home()));
  };

  titles = async (req: Request, res: Response): Promise<void> => {
    res.json(hanimeListView(await this.hanime.list(listQuery(req))));
  };

  title = async (req: Request, res: Response): Promise<void> => {
    const slug = paramString(req, 'slug');
    if (!SLUG.test(slug)) throw HttpError.notFound();
    res.json(hanimeTitleView(await this.hanime.title(slug)));
  };

  /** The title page's Preview storyboard, length, badges and other names. */
  details = async (req: Request, res: Response): Promise<void> => {
    const slug = paramString(req, 'slug');
    if (!SLUG.test(slug)) throw HttpError.notFound();
    res.json(hanimeDetailsView(await this.hanime.titleDetails(slug.toLowerCase())));
  };

  seasons = async (req: Request, res: Response): Promise<void> => {
    const raw = queryString(req, 'year');
    if (raw !== undefined && !/^\d{4}$/.test(raw))
      throw HttpError.badRequest('year must look like 2026');
    res.json(hanimeSeasonsView(await this.hanime.seasons(raw === undefined ? null : Number(raw))));
  };

  random = async (_req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(hanimeCardView(await this.hanime.random()));
  };

  tags = async (_req: Request, res: Response): Promise<void> => {
    res.json(hanimeTagsView(await this.hanime.tags()));
  };

  studios = async (req: Request, res: Response): Promise<void> => {
    const sort = queryString(req, 'sort') ?? 'count';
    if (sort !== 'count' && sort !== 'name')
      throw HttpError.badRequest('sort must be count or name');
    res.json(hanimeRefsView(await this.hanime.studios(sort)));
  };

  suggest = async (req: Request, res: Response): Promise<void> => {
    const q = queryString(req, 'q') ?? '';
    if (q.length > 200) throw HttpError.badRequest('q is too long');
    const limit = intParam(req, 'limit', 6, 1, 20);
    res.json(hanimeSuggestView(await this.hanime.suggest(q, limit)));
  };

  changes = async (req: Request, res: Response): Promise<void> => {
    const since = queryString(req, 'since') ?? null;
    if (since !== null && Number.isNaN(Date.parse(since)))
      throw HttpError.badRequest('since must be a date');
    const limit = intParam(req, 'limit', 50, 1, 500);
    res.json(hanimeChangesView(await this.hanime.changes(since, limit)));
  };

  status = async (_req: Request, res: Response): Promise<void> => {
    res.json(hanimeStatusView(await this.sync.status()));
  };

  /** Runs a sync now, then answers with the status. */
  syncNow = async (_req: Request, res: Response): Promise<void> => {
    await this.sync.syncNow().catch((err: unknown) => {
      // A failed download is reported in the status; only "too soon" is the caller's problem.
      if (err instanceof HttpError && err.status === 429) throw err;
    });
    res.json(hanimeStatusView(await this.sync.status()));
  };

  /** Server-Sent Events: `catalog` with what changed, each time a sync changes something. */
  events = (req: Request, res: Response): void => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 10000\n\n');
    const off = this.sync.onChange((result) => {
      res.write(`event: catalog\ndata: ${JSON.stringify(result)}\n\n`);
    });
    const ping = setInterval(() => res.write(': ping\n\n'), KEEP_ALIVE_MS);
    ping.unref();
    req.on('close', () => {
      clearInterval(ping);
      off();
    });
  };
}

function listQuery(req: Request): HanimeQuery {
  const q = queryString(req, 'q')?.trim();
  if (q !== undefined && q.length > 200) throw HttpError.badRequest('q is too long');
  const rawSort = queryString(req, 'sort') ?? (q ? 'relevance' : 'uploaded');
  if (!isHanimeSort(rawSort)) throw HttpError.badRequest(`"${rawSort}" is not a sort`);
  const order = queryString(req, 'order') ?? (rawSort === 'name' ? 'asc' : 'desc');
  if (order !== 'asc' && order !== 'desc') throw HttpError.badRequest('order must be asc or desc');
  const tagMode = queryString(req, 'tagMode') ?? 'and';
  if (tagMode !== 'and' && tagMode !== 'or')
    throw HttpError.badRequest('tagMode must be and or or');
  const censored = queryString(req, 'censored') ?? 'all';
  if (censored !== 'all' && censored !== 'censored' && censored !== 'uncensored') {
    throw HttpError.badRequest('censored must be all, censored or uncensored');
  }
  const series = queryString(req, 'series');
  if (series !== undefined && series.length > 200) throw HttpError.badRequest('series is too long');
  return {
    q: q === '' ? undefined : q,
    tags: slugList(req, 'tags'),
    tagMode,
    exclude: slugList(req, 'exclude'),
    studios: slugList(req, 'studios'),
    censorship: censored === 'all' ? null : censored,
    years: yearRange(queryString(req, 'year')),
    series: series === '' ? undefined : series,
    sort: rawSort,
    order,
    page: intParam(req, 'page', 1, 1, 999_999),
    size: intParam(req, 'size', 24, 1, 60),
  };
}

/** `a,b,c` → `['a', 'b', 'c']`, each a slug. */
function slugList(req: Request, name: string): string[] {
  const raw = queryString(req, name);
  if (raw === undefined || raw === '') return [];
  const value = raw.toLowerCase();
  if (!SLUG_LIST.test(value))
    throw HttpError.badRequest(`${name} must be slugs separated by commas`);
  return [...new Set(value.split(','))];
}

/** `2015,2026`, `2015-2026` or `2024` → both ends, in order; null when absent. */
function yearRange(raw: string | undefined): [number, number] | null {
  if (raw === undefined || raw === '') return null;
  const match = /^(\d{4})(?:[,-](\d{4}))?$/.exec(raw);
  if (!match) throw HttpError.badRequest('year must look like 2024 or 2015,2026');
  const a = Number(match[1]);
  const b = Number(match[2] ?? match[1]);
  return a <= b ? [a, b] : [b, a];
}

function intParam(req: Request, name: string, fallback: number, min: number, max: number): number {
  const raw = queryString(req, name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw HttpError.badRequest(`${name} must be a whole number from ${min} to ${max}`);
  }
  return n;
}
