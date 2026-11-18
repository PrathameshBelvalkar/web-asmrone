import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Logger } from 'pino';
import type { HanimeClient } from '../../extension/hanime/hanime.client.js';
import { isBlockedTitle, toRecord } from '../../extension/hanime/mappers.js';
import { parseBrowseTags, type TagArt } from '../../extension/hanime/parsers.js';
import { catalogSchema, rawTitleSchema } from '../../extension/hanime/schema.js';
import { Mutex } from '../../lib/mutex.js';
import { HttpError } from '../../models/errors.js';
import type {
  HanimeChange,
  HanimeRecord,
  HanimeStatus,
  HanimeSyncResult,
} from '../../models/hanime.js';
import type {
  HanimeRepository,
  HanimeState,
  ViewsFile,
} from '../../repositories/hanime.repository.js';
import { HanimeCatalog, type ViewsBaseline } from './catalog.js';

const DAY_MS = 24 * 60 * 60_000;
/** A download with more bad titles than this share, or fewer titles than this share of the last catalog, is rejected. */
const MAX_BAD_SHARE = 0.05;
const MIN_KEPT_SHARE = 0.5;
/** Fields whose change counts as an update. Counts change on every download and don't. */
const TRACKED: readonly (keyof HanimeRecord)[] = [
  'name',
  'slug',
  'description',
  'tags',
  'studio',
  'poster',
  'cover',
  'releasedAt',
];

export interface HanimeSyncOptions {
  readonly intervalMs: number;
  /** The shortest gap between two syncs asked for by hand. */
  readonly manualGapMs: number;
  readonly now?: () => number;
  readonly logger: Logger;
}

/**
 * Keeps the catalog in step with hanime (docs/HANIME.md, section 5): loads the last copy at start-up,
 * then downloads the catalog on a timer, skips it when nothing changed, records what's new, changed
 * or gone, and tells listeners. One sync runs at a time.
 */
export class HanimeSyncService {
  private current = new HanimeCatalog([]);
  private state: HanimeState | null = null;
  private hash = '';
  private readonly gate = new Mutex();
  private readonly events = new EventEmitter();
  private readonly now: () => number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private loaded: Promise<void> | null = null;
  private lastManualAt = Number.NEGATIVE_INFINITY;
  private art = new Map<string, TagArt>();

  constructor(
    private readonly client: HanimeClient,
    private readonly repo: HanimeRepository,
    private readonly options: HanimeSyncOptions,
  ) {
    this.now = options.now ?? Date.now;
    this.events.setMaxListeners(0);
  }

  get catalog(): HanimeCatalog {
    return this.current;
  }

  /** The Browse page's description and picture for each tag, by tag name. */
  get tagArt(): ReadonlyMap<string, TagArt> {
    return this.art;
  }

  /** Loads the saved copy (once). Safe to call many times. */
  load(): Promise<void> {
    this.loaded ??= this.loadSaved();
    return this.loaded;
  }

  /** Loads the saved copy, syncs, then syncs again every `intervalMs`. */
  start(): void {
    if (this.timer !== null) return;
    const tick = (): void => {
      this.sync().catch(() => undefined);
    };
    void this.load().then(tick);
    this.timer = setInterval(tick, this.options.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** Called with each sync that changed something. Returns the unsubscribe function. */
  onChange(listener: (result: HanimeSyncResult) => void): () => void {
    this.events.on('change', listener);
    return () => this.events.off('change', listener);
  }

  /** A sync asked for by hand. Throws 429 when one was asked for in the last `manualGapMs`. */
  async syncNow(): Promise<HanimeSyncResult | null> {
    if (this.now() - this.lastManualAt < this.options.manualGapMs) {
      throw new HttpError(
        429,
        'other',
        'The catalog was refreshed a moment ago. Try again in a few minutes.',
      );
    }
    this.lastManualAt = this.now();
    return this.sync();
  }

  async status(): Promise<HanimeStatus> {
    await this.load();
    const s = this.state;
    return {
      titles: this.current.size,
      lastCheckedAt: s?.lastCheckedAt ?? null,
      lastChangedAt: s?.lastChangedAt ?? null,
      syncing: this.running,
      paused: this.client.isPaused(),
      error: s?.lastError ?? null,
    };
  }

  changes(): Promise<HanimeChange[]> {
    return this.repo.readChanges();
  }

  /** Downloads the catalog and applies it. Returns what changed, or null when nothing did. */
  sync(): Promise<HanimeSyncResult | null> {
    return this.gate.run(async () => {
      await this.load();
      this.running = true;
      const state = this.state ?? (await this.repo.readState());
      try {
        const body = await this.download(state);
        const at = new Date(this.now()).toISOString();
        state.lastCheckedAt = at;
        state.lastError = null;
        const hash = createHash('sha256').update(body).digest('hex');
        // Tag pictures are checked daily even when the catalog is unchanged.
        if (hash === this.hash) {
          await this.refreshTagArt(state);
          await this.repo.writeState(state);
          return null;
        }
        const result = await this.apply(body, hash, at, state);
        await this.checkSitemap(state);
        await this.refreshTagArt(state);
        await this.repo.writeState(state);
        if (result.added + result.updated + result.removed > 0) {
          this.events.emit('change', result);
        }
        return result;
      } catch (err) {
        state.lastError = err instanceof Error ? err.message : String(err);
        await this.repo.writeState(state).catch(() => undefined);
        this.options.logger.warn({ err }, 'hanime: sync failed');
        throw err;
      } finally {
        this.state = state;
        this.running = false;
      }
    });
  }

  private async loadSaved(): Promise<void> {
    const [file, views, state, art] = await Promise.all([
      this.repo.readCatalog(),
      this.repo.readViews(),
      this.repo.readState(),
      this.repo.readTagArt(),
    ]);
    this.state = state;
    this.art = new Map(Object.entries(art));
    if (file === null) return;
    this.hash = file.hash;
    this.current = new HanimeCatalog(
      file.titles,
      new Set(file.blocked),
      baselineOf(views, this.now()),
    );
  }

  /** The catalog's text. If its address answers 404, looks for the new one on the home page once. */
  private async download(state: HanimeState): Promise<string> {
    try {
      return await this.client.catalog(state.catalogUrl ?? undefined);
    } catch (err) {
      if (!(err instanceof HttpError) || err.status !== 404) throw err;
      const moved = await this.client.discoverCatalogUrl();
      if (moved === null || moved === state.catalogUrl) throw err;
      this.options.logger.info({ url: moved }, 'hanime: the catalog moved');
      state.catalogUrl = moved;
      return this.client.catalog(moved);
    }
  }

  private async apply(
    body: string,
    hash: string,
    at: string,
    state: HanimeState,
  ): Promise<HanimeSyncResult> {
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw HttpError.upstream(502, 'hanime’s catalog was not valid JSON');
    }
    const outer = catalogSchema.safeParse(json);
    if (!outer.success) throw HttpError.upstream(502, 'hanime’s catalog has an unexpected shape');

    const records: HanimeRecord[] = [];
    const blocked: string[] = [];
    let bad = 0;
    const seen = new Set<number>();
    for (const item of outer.data.data) {
      const parsed = rawTitleSchema.safeParse(item);
      if (!parsed.success) {
        bad += 1;
        continue;
      }
      if (seen.has(parsed.data.id)) continue;
      seen.add(parsed.data.id);
      if (isBlockedTitle(parsed.data)) blocked.push(parsed.data.slug.toLowerCase());
      else records.push(toRecord(parsed.data));
    }
    const total = outer.data.data.length;
    const previous = this.current;
    if (total === 0 || bad / total > MAX_BAD_SHARE) {
      throw HttpError.upstream(
        502,
        `hanime’s catalog had ${bad} of ${total} titles NekoHub couldn’t read`,
      );
    }
    if (previous.size > 0 && records.length < previous.size * MIN_KEPT_SHARE) {
      throw HttpError.upstream(
        502,
        `hanime’s catalog had only ${records.length} titles (NekoHub has ${previous.size}); keeping the copy`,
      );
    }
    if (bad > 0)
      this.options.logger.warn({ bad, total }, 'hanime: skipped titles that could not be read');

    const changes = diff(previous, records, at);
    const views = await this.repo.readViews();
    const day = at.slice(0, 10);
    views.days[day] = Object.fromEntries(records.map((r) => [String(r.id), r.views]));

    this.current = new HanimeCatalog(records, new Set(blocked), baselineOf(views, this.now()));
    this.hash = hash;
    await this.repo.writeCatalog({ fetchedAt: at, hash, titles: records, blocked });
    await this.repo.writeViews(views);
    if (changes.length > 0) {
      // The first download isn't news: every title would be "added".
      if (previous.size > 0)
        await this.repo.writeChanges([...changes, ...(await this.repo.readChanges())]);
      state.lastChangedAt = at;
    }
    const count = (kind: HanimeChange['kind']): number =>
      previous.size === 0 ? 0 : changes.filter((c) => c.kind === kind).length;
    return { added: count('added'), updated: count('updated'), removed: count('removed'), at };
  }

  /** Once a day: reads the tags' descriptions and pictures from the Browse page. A failure keeps the last ones. */
  private async refreshTagArt(state: HanimeState): Promise<void> {
    const last = state.lastTagArtAt === null ? 0 : Date.parse(state.lastTagArtAt);
    if (this.now() - last < DAY_MS && this.art.size > 0) return;
    state.lastTagArtAt = new Date(this.now()).toISOString();
    try {
      const art = parseBrowseTags(await this.client.browsePage());
      if (art.size === 0) return;
      this.art = art;
      await this.repo.writeTagArt(Object.fromEntries(art));
    } catch (err) {
      this.options.logger.warn({ err }, 'hanime: reading the tag pictures failed');
    }
  }

  /** Once a day: compares the sitemap's titles with the catalog and logs the difference. */
  private async checkSitemap(state: HanimeState): Promise<void> {
    const last = state.lastSitemapAt === null ? 0 : Date.parse(state.lastSitemapAt);
    if (this.now() - last < DAY_MS) return;
    state.lastSitemapAt = new Date(this.now()).toISOString();
    try {
      const slugs = new Set(await this.client.sitemapSlugs());
      const known = new Set([
        ...this.current.entries.map((e) => e.slug),
        ...this.current.blockedSlugs,
      ]);
      const onlySitemap = [...slugs].filter((s) => !known.has(s));
      const onlyCatalog = [...known].filter((s) => !slugs.has(s));
      this.options.logger.info(
        {
          sitemap: slugs.size,
          catalog: known.size,
          onlySitemap: onlySitemap.slice(0, 20),
          onlyCatalog: onlyCatalog.slice(0, 20),
        },
        'hanime: sitemap check',
      );
    } catch (err) {
      this.options.logger.warn({ err }, 'hanime: sitemap check failed');
    }
  }
}

/** Added, updated and removed titles, matched by id. View and like counts don't count as changes. */
export function diff(
  previous: HanimeCatalog,
  next: readonly HanimeRecord[],
  at: string,
): HanimeChange[] {
  const out: HanimeChange[] = [];
  const nextIds = new Set<number>();
  const before = new Map(previous.entries.map((e) => [e.record.id, e.record]));
  for (const r of next) {
    nextIds.add(r.id);
    const old = before.get(r.id);
    const base = { at, id: r.id, slug: r.slug, name: r.name, poster: r.poster };
    if (old === undefined) {
      out.push({ ...base, kind: 'added' });
      continue;
    }
    const fields = TRACKED.filter((k) => JSON.stringify(old[k]) !== JSON.stringify(r[k]));
    if (fields.length > 0) out.push({ ...base, kind: 'updated', fields });
  }
  for (const old of before.values()) {
    if (!nextIds.has(old.id)) {
      out.push({
        at,
        kind: 'removed',
        id: old.id,
        slug: old.slug,
        name: old.name,
        poster: old.poster,
      });
    }
  }
  return out;
}

/** The views from about a week ago (the oldest day kept if there's less), or null with under a day. */
export function baselineOf(views: ViewsFile, now: number): ViewsBaseline | null {
  const week = new Date(now - 7 * DAY_MS).toISOString().slice(0, 10);
  const days = Object.keys(views.days).sort();
  const pick = days.filter((d) => d >= week)[0] ?? days.at(-1);
  if (pick === undefined) return null;
  const at = Date.parse(`${pick}T00:00:00Z`);
  if (now - at < DAY_MS) return null;
  const map = views.days[pick] ?? {};
  return { at, views: new Map(Object.entries(map).map(([id, v]) => [Number(id), v])) };
}
