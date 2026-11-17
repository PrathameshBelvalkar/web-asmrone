import { FORMAT_TAGS, slugify } from '../../extension/hanime/constants.js';
import { censorshipOf, seriesOf } from '../../extension/hanime/mappers.js';
import type { HanimeCard, HanimeRecord, HanimeRef } from '../../models/hanime.js';
import { field, normalise, queryTokens, score, type Searchable } from './search-index.js';

const DAY_MS = 24 * 60 * 60_000;
const NEW_FOR_MS = 7 * DAY_MS;

/** One title with everything worked out once, when the catalog is built. */
export interface Entry extends Searchable {
  readonly record: HanimeRecord;
  readonly seriesKey: string;
  readonly seriesName: string;
  readonly episode: number | null;
  readonly tagSlugs: ReadonlySet<string>;
  readonly releasedMs: number;
  readonly uploadedMs: number;
}

/** A views count on a day, for Trending. */
export interface ViewsBaseline {
  readonly at: number;
  readonly views: ReadonlyMap<number, number>;
}

/**
 * The catalog in memory: every title, with maps by slug, tag, studio and series, and search. Pure:
 * it makes no requests and reads no files. The sync builds a new one and swaps it in.
 */
export class HanimeCatalog {
  readonly entries: readonly Entry[];
  private readonly bySlug = new Map<string, Entry>();
  private readonly series = new Map<string, Entry[]>();
  private readonly tagRefs = new Map<string, HanimeRef>();
  private readonly studioRefs = new Map<string, HanimeRef>();

  constructor(
    records: readonly HanimeRecord[],
    /** Slugs a content rule removed, so asking for one answers 451, not 404. */
    readonly blockedSlugs: ReadonlySet<string> = new Set(),
    private readonly baseline: ViewsBaseline | null = null,
  ) {
    const tagCounts = new Map<string, { name: string; count: number }>();
    const studioCounts = new Map<string, { name: string; count: number }>();
    this.entries = records.map((record) => {
      const s = seriesOf(record.name);
      const tagSlugs = new Set(record.tags.map(slugify));
      for (const tag of record.tags) {
        const slug = slugify(tag);
        const t = tagCounts.get(slug) ?? { name: tag, count: 0 };
        t.count += 1;
        tagCounts.set(slug, t);
      }
      const st = studioCounts.get(record.studio.slug) ?? { name: record.studio.name, count: 0 };
      st.count += 1;
      studioCounts.set(record.studio.slug, st);
      const entry: Entry = {
        record,
        seriesKey: s.key,
        seriesName: s.name,
        episode: s.episode,
        tagSlugs,
        releasedMs: Date.parse(record.releasedAt),
        uploadedMs: Date.parse(record.uploadedAt),
        name: field(record.name),
        other: field(`${record.searchText} ${record.studio.name}`),
        tags: field(record.tags.join(' ')),
        nameNorm: normalise(record.name),
        slug: record.slug,
        views: record.views,
      };
      this.bySlug.set(record.slug, entry);
      const list = this.series.get(s.key) ?? [];
      list.push(entry);
      this.series.set(s.key, list);
      return entry;
    });
    for (const list of this.series.values()) {
      list.sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0) || a.releasedMs - b.releasedMs);
    }
    for (const [slug, t] of tagCounts)
      this.tagRefs.set(slug, { slug, name: t.name, count: t.count });
    for (const [slug, s] of studioCounts)
      this.studioRefs.set(slug, { slug, name: s.name, count: s.count });
  }

  get size(): number {
    return this.entries.length;
  }

  get(slug: string): Entry | undefined {
    return this.bySlug.get(slug.toLowerCase());
  }

  isBlocked(slug: string): boolean {
    return this.blockedSlugs.has(slug.toLowerCase());
  }

  /** Every tag, with how many titles have it. */
  tagList(): HanimeRef[] {
    return [...this.tagRefs.values()];
  }

  tag(slug: string): HanimeRef | undefined {
    return this.tagRefs.get(slug);
  }

  studioList(): HanimeRef[] {
    return [...this.studioRefs.values()];
  }

  studio(slug: string): HanimeRef | undefined {
    return this.studioRefs.get(slug);
  }

  /** The titles of a series, by episode. */
  seriesOf(key: string): readonly Entry[] {
    return this.series.get(key) ?? [];
  }

  /** Every title that matches the query, best first, with its score. */
  search(q: string): { entry: Entry; score: number }[] {
    const tokens = queryTokens(q);
    const qNorm = normalise(q);
    const out: { entry: Entry; score: number }[] = [];
    for (const entry of this.entries) {
      const s = score(entry, tokens, qNorm);
      if (s > 0) out.push({ entry, score: s });
    }
    return out.sort((a, b) => b.score - a.score || b.entry.views - a.entry.views);
  }

  /** Titles that share the most story tags with this one, outside its own series. */
  similar(entry: Entry, limit: number): Entry[] {
    const mine = [...entry.tagSlugs].filter((t) => !FORMAT_TAGS.has(t));
    if (mine.length === 0) return [];
    return this.entries
      .filter((e) => e.seriesKey !== entry.seriesKey)
      .map((e) => ({ e, shared: mine.filter((t) => e.tagSlugs.has(t)).length }))
      .filter((x) => x.shared > 0)
      .sort((a, b) => b.shared - a.shared || b.e.views - a.e.views)
      .slice(0, limit)
      .map((x) => x.e);
  }

  /**
   * Views a day: gained since the baseline when it's at least a day old, otherwise the average since
   * upload. Both are views a day, so the two can be compared.
   */
  trendingScore(entry: Entry, now: number): number {
    const base = this.baseline;
    const before = base?.views.get(entry.record.id);
    if (base !== null && before !== undefined && now - base.at >= DAY_MS) {
      return Math.max(0, entry.record.views - before) / ((now - base.at) / DAY_MS);
    }
    return entry.record.views / Math.max(1, (now - entry.uploadedMs) / DAY_MS);
  }

  card(entry: Entry, now: number): HanimeCard {
    const r = entry.record;
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      poster: r.poster,
      cover: r.cover,
      studio: r.studio,
      releasedAt: r.releasedAt,
      uploadedAt: r.uploadedAt,
      views: r.views,
      likes: r.likes,
      censorship: censorshipOf(r.tags),
      episode: this.seriesOf(entry.seriesKey).length > 1 ? entry.episode : null,
      isNew: now - entry.uploadedMs < NEW_FOR_MS,
    };
  }
}
