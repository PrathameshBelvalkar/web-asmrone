import {
  FORMAT_TAGS,
  OTHER_TAG_GROUP,
  TAG_GROUPS,
  slugify,
  titleUrl,
} from '../extension/hanime/constants.js';
import type { HanimeClient } from '../extension/hanime/hanime.client.js';
import { censorshipOf } from '../extension/hanime/mappers.js';
import { parseTitlePage } from '../extension/hanime/parsers.js';
import { LruCache } from '../lib/lru-cache.js';
import { BLOCKED_WORD } from '../lib/content-rules.js';
import { HttpError } from '../models/errors.js';
import type {
  HanimeCard,
  HanimeChange,
  HanimeDetails,
  HanimeList,
  HanimeQuery,
  HanimeRef,
  HanimeSeasonName,
  HanimeSeasons,
  HanimeShelf,
  HanimeSort,
  HanimeStatus,
  HanimeSuggestion,
  HanimeTagGroup,
  HanimeTagRef,
  HanimeTitle,
} from '../models/hanime.js';
import type { HanimeAvailability } from './hanime/availability.service.js';
import type { Entry, HanimeCatalog } from './hanime/catalog.js';
import type { HanimeSyncService } from './hanime/sync.service.js';

const SHELF_SIZE = 12;
const SIMILAR = 12;
/** Titles with fewer votes than this rank below the rest by rating. */
const MIN_VOTES = 100;
const UNAVAILABLE = 'This title isn’t available in Echo.';
const EMPTY = 'Echo is still getting hanime’s catalog. Try again in a moment.';
const NO_VIDEO = 'hentaibros.net has no video for this title.';
/** Seasons by release month (Jan–Mar is Winter), newest first. */
const SEASONS: readonly { season: HanimeSeasonName; months: readonly number[] }[] = [
  { season: 'Fall', months: [9, 10, 11] },
  { season: 'Summer', months: [6, 7, 8] },
  { season: 'Spring', months: [3, 4, 5] },
  { season: 'Winter', months: [0, 1, 2] },
];

export interface HanimeServiceOptions {
  /** How long a title page's details are kept. */
  readonly detailsTtlMs: number;
  readonly now?: () => number;
}

/**
 * Hanime: every list, filter, sort and search, answered from the catalog in memory. Only titles with
 * a video on hentaibros.net are listed (`HanimeAvailability`). A title's Preview, length and other
 * names come from its page on the site, read when the title is opened.
 */
export class HanimeService {
  private readonly details = new LruCache<string, { at: number; value: HanimeDetails }>(500);
  private readonly pending = new Map<string, Promise<HanimeDetails>>();
  private readonly now: () => number;

  constructor(
    private readonly sync: HanimeSyncService,
    private readonly client: HanimeClient,
    private readonly available: HanimeAvailability,
    private readonly options: HanimeServiceOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  private async catalog(): Promise<HanimeCatalog> {
    await this.sync.load();
    const catalog = this.sync.catalog;
    if (catalog.size === 0) {
      const status = await this.sync.status();
      throw new HttpError(503, 'upstream', status.error ?? EMPTY);
    }
    return this.available.catalog();
  }

  /** A listed title. One the catalog has but without a video answers 404 saying so. */
  private async entry(slug: string): Promise<{ c: HanimeCatalog; entry: Entry }> {
    const c = await this.catalog();
    if (c.isBlocked(slug)) throw new HttpError(451, 'forbidden', UNAVAILABLE);
    const entry = c.get(slug);
    if (entry !== undefined) return { c, entry };
    if (this.sync.catalog.get(slug) !== undefined) throw new HttpError(404, 'not_found', NO_VIDEO);
    throw HttpError.notFound();
  }

  /** The sync's status, counting the titles that are listed. */
  async status(): Promise<HanimeStatus> {
    const status = await this.sync.status();
    return status.titles === 0 ? status : { ...status, titles: (await this.catalog()).size };
  }

  async home(): Promise<HanimeShelf[]> {
    const c = await this.catalog();
    const now = this.now();
    const shelf = (
      key: string,
      title: string,
      browse: Record<string, string>,
      entries: Entry[],
    ): HanimeShelf => ({
      key,
      title,
      browse,
      items: entries.slice(0, SHELF_SIZE).map((e) => c.card(e, now)),
    });
    const sorted = (sort: HanimeSort, from: readonly Entry[] = c.entries): Entry[] =>
      sortEntries(c, [...from], sort, 'desc', now);
    const popularTags = c
      .tagList()
      .filter((t) => !FORMAT_TAGS.has(t.name))
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 4);
    return [
      shelf('new', 'New uploads', { sort: 'uploaded' }, sorted('uploaded')),
      shelf('trending', 'Trending', { sort: 'trending' }, sorted('trending')),
      shelf('views', 'Most viewed', { sort: 'views' }, sorted('views')),
      shelf('rating', 'Top rated', { sort: 'rating' }, sorted('rating')),
      ...popularTags.map((t) =>
        shelf(
          `tag:${t.slug}`,
          capitalise(t.name),
          { tags: t.slug, sort: 'trending' },
          sorted(
            'trending',
            c.entries.filter((e) => e.tagSlugs.has(t.slug)),
          ),
        ),
      ),
    ];
  }

  async list(query: HanimeQuery): Promise<HanimeList<HanimeCard>> {
    const c = await this.catalog();
    const now = this.now();
    for (const slug of [...query.tags, ...query.exclude]) {
      if (BLOCKED_WORD.test(slug)) throw new HttpError(451, 'forbidden', UNAVAILABLE);
      if (c.tag(slug) === undefined) throw HttpError.badRequest(`There is no tag "${slug}"`);
    }
    for (const slug of query.studios) {
      if (c.studio(slug) === undefined) throw HttpError.badRequest(`There is no studio "${slug}"`);
    }
    const q = query.q?.trim() ?? '';
    if (q !== '' && BLOCKED_WORD.test(q)) return page([], query.page, query.size);

    let entries: Entry[];
    let scores: Map<Entry, number> | null = null;
    if (q !== '') {
      const hits = c.search(q);
      scores = new Map(hits.map((h) => [h.entry, h.score]));
      entries = hits.map((h) => h.entry);
    } else {
      entries = [...c.entries];
    }
    entries = entries.filter((e) => matches(e, query));
    const sort = query.sort === 'relevance' && scores === null ? 'uploaded' : query.sort;
    if (sort !== 'relevance') entries = sortEntries(c, entries, sort, query.order, now);
    else if (query.order === 'asc') entries.reverse();
    return page(
      entries.map((e) => c.card(e, now)),
      query.page,
      query.size,
    );
  }

  async title(slug: string): Promise<HanimeTitle> {
    const { c, entry } = await this.entry(slug);
    const now = this.now();
    const r = entry.record;
    const series = c.seriesOf(entry.seriesKey);
    const votes = r.likes + r.dislikes;
    return {
      ...c.card(entry, now),
      altTitles: r.altTitles,
      description: r.description,
      tags: r.tags.map((t) => ({ slug: slugify(t), name: t })),
      dislikes: r.dislikes,
      downloads: r.downloads,
      rating: votes === 0 ? null : r.likes / votes,
      series: series.length > 1 ? { key: entry.seriesKey, name: entry.seriesName } : null,
      episodes: series.length > 1 ? series.map((e) => c.card(e, now)) : [],
      similar: c.similar(entry, SIMILAR).map((e) => c.card(e, now)),
      siteUrl: titleUrl(r.slug),
    };
  }

  /** The tags in their groups (constants.ts), most used first; unknown tags go into Other. */
  /** The tags in their groups, most used first, with the site's description and picture for each. */
  async tags(): Promise<HanimeTagGroup[]> {
    const c = await this.catalog();
    const art = this.sync.tagArt;
    const refs = new Map(
      c.tagList().map((t): [string, HanimeTagRef] => {
        const a = art.get(t.name);
        return [t.name, { ...t, description: a?.description ?? null, image: a?.image ?? null }];
      }),
    );
    const used = new Set<string>();
    const groups: HanimeTagGroup[] = TAG_GROUPS.map((g) => {
      const tags = g.tags.flatMap((name) => {
        const ref = refs.get(name);
        if (ref === undefined) return [];
        used.add(name);
        return [ref];
      });
      return { group: g.group, tags: byCount(tags) };
    });
    const other = [...refs.values()].filter((t) => !used.has(t.name));
    if (other.length > 0) groups.push({ group: OTHER_TAG_GROUP, tags: byCount(other) });
    return groups.filter((g) => g.tags.length > 0);
  }

  /**
   * What only the title's page has: the Preview storyboard, the length, the badges and the other
   * names. Kept for `detailsTtlMs`; requests for the same title at once share one page read.
   */
  async titleDetails(slug: string): Promise<HanimeDetails> {
    const { entry } = await this.entry(slug);
    const hit = this.details.get(entry.slug);
    if (hit !== undefined && this.now() - hit.at < this.options.detailsTtlMs) return hit.value;
    const running = this.pending.get(entry.slug);
    if (running !== undefined) return running;
    const task = this.client
      .titlePage(entry.slug)
      .then((html) => {
        const value = parseTitlePage(html);
        this.details.set(entry.slug, { at: this.now(), value });
        return value;
      })
      .finally(() => this.pending.delete(entry.slug));
    this.pending.set(entry.slug, task);
    return task;
  }

  /** One year's releases by season (Winter is January to March), and every year there are titles for. */
  async seasons(year: number | null): Promise<HanimeSeasons> {
    const c = await this.catalog();
    const now = this.now();
    const years = [...new Set(c.entries.map((e) => new Date(e.releasedMs).getUTCFullYear()))].sort(
      (a, b) => b - a,
    );
    const pick =
      year !== null && years.includes(year) ? year : (years[0] ?? new Date(now).getUTCFullYear());
    const inYear = c.entries.filter((e) => new Date(e.releasedMs).getUTCFullYear() === pick);
    const seasons = SEASONS.map(({ season, months }) => ({
      season,
      items: inYear
        .filter((e) => months.includes(new Date(e.releasedMs).getUTCMonth()))
        .sort((a, b) => b.releasedMs - a.releasedMs || b.record.views - a.record.views)
        .map((e) => c.card(e, now)),
    })).filter((s) => s.items.length > 0);
    return { years, year: pick, seasons };
  }

  /** Any one title. */
  async random(): Promise<HanimeCard> {
    const c = await this.catalog();
    const entry = c.entries[Math.floor(Math.random() * c.size)];
    if (entry === undefined) throw HttpError.notFound();
    return c.card(entry, this.now());
  }

  async studios(sort: 'count' | 'name'): Promise<HanimeRef[]> {
    const c = await this.catalog();
    const list = c.studioList();
    return sort === 'name' ? list.sort((a, b) => a.name.localeCompare(b.name)) : byCount(list);
  }

  /** Up to `limit` titles, then up to 2 series, 3 tags and 2 studios that match what's been typed. */
  async suggest(q: string, limit: number): Promise<HanimeSuggestion[]> {
    const c = await this.catalog();
    const text = q.trim();
    if (text === '' || BLOCKED_WORD.test(text)) return [];
    const now = this.now();
    const hits = c.search(text);
    const out: HanimeSuggestion[] = hits
      .slice(0, limit)
      .map((h) => ({ type: 'title', card: c.card(h.entry, now) }));

    const seen = new Set<string>();
    for (const h of hits) {
      if (seen.size >= 2) break;
      const series = c.seriesOf(h.entry.seriesKey);
      if (series.length < 2 || seen.has(h.entry.seriesKey)) continue;
      seen.add(h.entry.seriesKey);
      out.push({
        type: 'series',
        key: h.entry.seriesKey,
        name: h.entry.seriesName,
        count: series.length,
        poster: series[0]?.record.cover ?? '',
      });
    }
    const needle = text.toLowerCase();
    const named = (refs: HanimeRef[]): HanimeRef[] =>
      byCount(refs.filter((r) => r.name.toLowerCase().includes(needle)));
    for (const ref of named(c.tagList()).slice(0, 3)) out.push({ type: 'tag', ref });
    for (const ref of named(c.studioList()).slice(0, 2)) out.push({ type: 'studio', ref });
    return out;
  }

  /** The newest changes, newest first, optionally only those after `since`. */
  async changes(since: string | null, limit: number): Promise<HanimeChange[]> {
    const all = await this.sync.changes();
    const after = since === null ? null : Date.parse(since);
    return all.filter((ch) => after === null || Date.parse(ch.at) > after).slice(0, limit);
  }
}

function matches(e: Entry, q: HanimeQuery): boolean {
  if (q.tags.length > 0) {
    const has = (t: string): boolean => e.tagSlugs.has(t);
    if (q.tagMode === 'and' ? !q.tags.every(has) : !q.tags.some(has)) return false;
  }
  if (q.exclude.some((t) => e.tagSlugs.has(t))) return false;
  if (q.studios.length > 0 && !q.studios.includes(e.record.studio.slug)) return false;
  if (q.censorship !== null && censorshipOf(e.record.tags) !== q.censorship) return false;
  if (q.years !== null) {
    const year = new Date(e.releasedMs).getUTCFullYear();
    if (year < q.years[0] || year > q.years[1]) return false;
  }
  if (q.series !== undefined && e.seriesKey !== q.series) return false;
  return true;
}

/** Likes ÷ votes, with titles under MIN_VOTES votes below every title that has enough. */
function rating(e: Entry): number {
  const votes = e.record.likes + e.record.dislikes;
  if (votes === 0) return -2;
  const share = e.record.likes / votes;
  return votes < MIN_VOTES ? share - 1 : share;
}

function sortEntries(
  c: HanimeCatalog,
  entries: Entry[],
  sort: Exclude<HanimeSort, 'relevance'> | HanimeSort,
  order: 'asc' | 'desc',
  now: number,
): Entry[] {
  if (sort === 'name') {
    entries.sort((a, b) => a.record.name.localeCompare(b.record.name, 'en', { numeric: true }));
    return order === 'desc' ? entries.reverse() : entries;
  }
  const key = (e: Entry): number => {
    switch (sort) {
      case 'released':
        return e.releasedMs;
      case 'views':
        return e.record.views;
      case 'likes':
        return e.record.likes;
      case 'rating':
        return rating(e);
      case 'downloads':
        return e.record.downloads;
      case 'trending':
        return c.trendingScore(e, now);
      default:
        return e.uploadedMs;
    }
  };
  const keys = new Map(entries.map((e) => [e, key(e)]));
  const sign = order === 'asc' ? 1 : -1;
  return entries.sort(
    (a, b) => sign * ((keys.get(a) ?? 0) - (keys.get(b) ?? 0)) || b.record.views - a.record.views,
  );
}

function page<T>(items: T[], pageNo: number, size: number): HanimeList<T> {
  const lastPage = Math.max(1, Math.ceil(items.length / size));
  return {
    items: items.slice((pageNo - 1) * size, pageNo * size),
    page: pageNo,
    lastPage,
    total: items.length,
    hasMore: pageNo < lastPage,
  };
}

const byCount = <T extends HanimeRef>(refs: T[]): T[] =>
  refs.sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name));

const capitalise = (s: string): string => s.replace(/\b\w/g, (ch) => ch.toUpperCase());
