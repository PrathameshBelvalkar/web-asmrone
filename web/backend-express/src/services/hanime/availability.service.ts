import type { Logger } from 'pino';
import type { HentaibrosClient } from '../../extension/hentaibros/hentaibros.client.js';
import type { HanimeRepository } from '../../repositories/hanime.repository.js';
import type { HanimeCatalog } from './catalog.js';
import { matchPost, streamPost, type StreamPost } from './stream-match.js';
import type { HanimeSyncService } from './sync.service.js';

export interface HanimeAvailabilityOptions {
  /** How long the list of hentaibros.net posts is used before it's read again. */
  readonly postsTtlMs: number;
  /** After a failed read, how long before the site is asked again. */
  readonly retryMs: number;
  readonly now?: () => number;
  readonly logger: Logger;
}

interface Matched {
  readonly source: HanimeCatalog;
  readonly posts: readonly StreamPost[];
  /** Only the titles with a post. */
  readonly catalog: HanimeCatalog;
  readonly bySlug: ReadonlyMap<string, StreamPost>;
}

/**
 * Which Hanime titles have a video on hentaibros.net (docs/HANIME.md section 12.5). The site's post
 * list (its sitemaps, read once a day and kept on disk) is matched against the catalog by name and
 * episode (`stream-match.ts`); Echo lists only the titles that find a post. The match is worked out
 * once for each catalog and post list. Until the list is first read, and while the site can't be
 * reached with no saved copy, every title is listed rather than none.
 */
export class HanimeAvailability {
  private posts: { at: number; value: StreamPost[] } | null = null;
  private failedAt = Number.NEGATIVE_INFINITY;
  private pending: Promise<void> | null = null;
  private loaded: Promise<void> | null = null;
  private matched: Matched | null = null;
  private readonly now: () => number;

  constructor(
    private readonly sync: HanimeSyncService,
    private readonly client: HentaibrosClient,
    private readonly repo: HanimeRepository,
    private readonly options: HanimeAvailabilityOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  /** The catalog with only the titles that have a video. */
  async catalog(): Promise<HanimeCatalog> {
    const all = this.sync.catalog;
    const posts = await this.postList();
    return posts === null ? all : this.match(all, posts).catalog;
  }

  /** The title's episode page on hentaibros.net, or null when it has none. */
  async post(slug: string): Promise<StreamPost | null> {
    const posts = await this.postList();
    if (posts === null) return null;
    return this.match(this.sync.catalog, posts).bySlug.get(slug.toLowerCase()) ?? null;
  }

  /** Loads the saved list and reads the site's when that's missing or old. Called at start-up. */
  async warm(): Promise<void> {
    await this.postList();
  }

  private match(source: HanimeCatalog, posts: StreamPost[]): Matched {
    const m = this.matched;
    if (m !== null && m.source === source && m.posts === posts) return m;
    const bySlug = new Map<string, StreamPost>();
    for (const e of source.entries) {
      const post = matchPost(e.record, posts);
      if (post !== null) bySlug.set(e.slug, post);
    }
    const next: Matched = {
      source,
      posts,
      catalog: source.only((e) => bySlug.has(e.slug)),
      bySlug,
    };
    this.matched = next;
    return next;
  }

  /**
   * The site's posts, or null when there are none to go by. An old list is used while a new one is
   * read in the background; with no list at all, the request waits for the read.
   */
  private async postList(): Promise<StreamPost[] | null> {
    this.loaded ??= this.loadSaved();
    await this.loaded;
    const now = this.now();
    const canRetry = now - this.failedAt >= this.options.retryMs;
    if (this.posts !== null) {
      if (now - this.posts.at >= this.options.postsTtlMs && canRetry) void this.refresh();
      return this.posts.value;
    }
    if (!canRetry) return null;
    await this.refresh();
    // `refresh` sets the list; TypeScript still has it as null from the check above.
    const read = this.posts as { value: StreamPost[] } | null;
    return read?.value ?? null;
  }

  private refresh(): Promise<void> {
    this.pending ??= this.client
      .postSlugs()
      .then(async (slugs) => {
        const at = this.now();
        this.posts = { at, value: slugs.map(streamPost) };
        await this.repo
          .writePosts({ fetchedAt: new Date(at).toISOString(), slugs })
          .catch((err: unknown) => {
            this.options.logger.warn({ err }, 'hentaibros: saving the post list failed');
          });
      })
      .catch((err: unknown) => {
        // A failed read keeps using the list it has.
        this.failedAt = this.now();
        this.options.logger.warn({ err }, 'hentaibros: reading the post list failed');
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }

  private async loadSaved(): Promise<void> {
    const file = await this.repo.readPosts();
    const at = file === null ? Number.NaN : Date.parse(file.fetchedAt);
    if (file !== null && !Number.isNaN(at)) this.posts = { at, value: file.slugs.map(streamPost) };
  }
}
