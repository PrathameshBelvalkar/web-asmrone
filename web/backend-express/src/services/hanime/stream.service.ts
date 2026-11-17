import { BLOCKED_SERIES } from '../../extension/hanime/constants.js';
import { postUrl } from '../../extension/hentaibros/constants.js';
import type { HentaibrosClient } from '../../extension/hentaibros/hentaibros.client.js';
import { episodeVideoOf } from '../../extension/hentaibros/parsers.js';
import { BLOCKED_WORD } from '../../lib/content-rules.js';
import { LruCache } from '../../lib/lru-cache.js';
import { HttpError } from '../../models/errors.js';
import type { HanimeStream } from '../../models/hanime.js';
import type { HanimeService } from '../hanime.service.js';
import { matchPost, streamPost, type StreamPost } from './stream-match.js';

const NO_PAGE = 'hentaibros.net has no video for this title.';
const UNAVAILABLE = 'This title isn’t available in Echo.';

export interface HanimeStreamServiceOptions {
  /** How long the list of hentaibros.net posts is used before it's read again. */
  readonly postsTtlMs: number;
  /** How long a title's video, or the lack of one, is remembered. */
  readonly streamTtlMs: number;
  readonly missTtlMs: number;
  readonly now?: () => number;
}

interface Timed<T> {
  readonly at: number;
  readonly value: T;
}

/**
 * A Hanime title's video, from its episode page on hentaibros.net (docs/HANIME.md section 12). The
 * title goes through the catalog first (content rules: 451, unknown: 404); its page is found among
 * the site's posts by name and episode (`stream-match.ts`); the page's player gives the MP4, which
 * the browser plays from its host. Every step is cached; requests for one title at once share them.
 */
export class HanimeStreamService {
  private posts: Timed<StreamPost[]> | null = null;
  private postsPending: Promise<StreamPost[]> | null = null;
  private readonly streams = new LruCache<string, Timed<HanimeStream | null>>(1_000);
  private readonly pending = new Map<string, Promise<HanimeStream>>();
  private readonly now: () => number;

  constructor(
    private readonly hanime: HanimeService,
    private readonly client: HentaibrosClient,
    private readonly options: HanimeStreamServiceOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  async stream(slug: string): Promise<HanimeStream> {
    const title = await this.hanime.title(slug);
    const hit = this.streams.get(title.slug);
    if (hit !== undefined) {
      const ttl = hit.value === null ? this.options.missTtlMs : this.options.streamTtlMs;
      if (this.now() - hit.at < ttl) {
        if (hit.value === null) throw new HttpError(404, 'not_found', NO_PAGE);
        return hit.value;
      }
    }
    const running = this.pending.get(title.slug);
    if (running !== undefined) return running;
    const task = this.resolve(title)
      .then((value) => {
        this.streams.set(title.slug, { at: this.now(), value });
        if (value === null) throw new HttpError(404, 'not_found', NO_PAGE);
        return value;
      })
      .finally(() => this.pending.delete(title.slug));
    this.pending.set(title.slug, task);
    return task;
  }

  private async resolve(title: {
    slug: string;
    name: string;
    altTitles: readonly string[];
  }): Promise<HanimeStream | null> {
    const post = matchPost(title, await this.postList());
    if (post === null) return null;
    // The content rules again, on the other site's names.
    if (BLOCKED_SERIES.test(post.slug.replace(/-/g, ' ')) || BLOCKED_WORD.test(post.slug)) {
      throw new HttpError(451, 'forbidden', UNAVAILABLE);
    }
    const video = episodeVideoOf(await this.client.episodePage(post.slug));
    if (video === null) return null;
    if (BLOCKED_SERIES.test(video.title) || BLOCKED_WORD.test(video.title)) {
      throw new HttpError(451, 'forbidden', UNAVAILABLE);
    }
    return { file: video.file, page: postUrl(post.slug), title: video.title };
  }

  /** The site's posts, read from its sitemaps at most once per `postsTtlMs`. */
  private async postList(): Promise<StreamPost[]> {
    if (this.posts !== null && this.now() - this.posts.at < this.options.postsTtlMs) {
      return this.posts.value;
    }
    this.postsPending ??= this.client
      .postSlugs()
      .then((slugs) => {
        const value = slugs.map(streamPost);
        this.posts = { at: this.now(), value };
        return value;
      })
      .catch((err: unknown) => {
        // A failed refresh keeps using the list it has.
        if (this.posts !== null) return this.posts.value;
        throw err;
      })
      .finally(() => {
        this.postsPending = null;
      });
    return this.postsPending;
  }
}
