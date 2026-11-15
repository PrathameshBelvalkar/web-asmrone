import type { Dispatcher } from 'undici';
import { BlockBackoff } from '../../../lib/block-backoff.js';
import { LruCache } from '../../../lib/lru-cache.js';
import { Mutex } from '../../../lib/mutex.js';
import { httpCall } from '../../../lib/http-client.js';
import { HttpError } from '../../../models/errors.js';
import { APP_USER_AGENT, THREEHENTAI_SITE } from '../constants.js';

export interface ThreehentaiClientOptions {
  /** Minimum gap between two requests to the site. */
  readonly gapMs: number;
  /** How long a page is kept, by kind of page. */
  readonly listingTtlMs: number;
  readonly galleryTtlMs: number;
  readonly indexTtlMs: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

interface CachedPage {
  readonly at: number;
  readonly html: string;
}

const CHALLENGE = /cdn-cgi\/challenge-platform|Just a moment/;
const PATH_OK =
  /^\/(?:kai\/?|search\/?|d\/\d+\/(?:\d+\/)?|(?:tag|artist|character|parody|group|language|category)\/[^/?#.][^/?#]*\/?|(?:tags|artists|characters|parodies|groups)\/?)$/i;
const SORTS = new Set(['popular', 'popular-24h', 'popular-7d']);
const BUSY = '3hentai.to is limiting requests right now. Try again later.';

/**
 * Only these addresses are ever requested: listings, search, galleries, reader pages and the A–Z
 * indexes, with their paging, sort and letter options. Anything else (the site's internal /api,
 * login, comments) is refused before a request is made.
 */
export function isAllowedAddress(url: URL): boolean {
  if (url.origin !== THREEHENTAI_SITE) return false;
  if (!PATH_OK.test(url.pathname) || url.pathname.includes('..')) return false;
  for (const [key, value] of url.searchParams) {
    if (key === 'page' && /^\d{1,6}$/.test(value)) continue;
    if (key === 'sort' && SORTS.has(value)) continue;
    if (key === 'letter' && /^(?:[a-z]|#)$/.test(value)) continue;
    if (key === 'q' && url.pathname.startsWith('/search')) continue;
    return false;
  }
  return true;
}

/**
 * HTML client for 3hentai.to. Requests run one at a time with a gap between them, pages are cached,
 * and a block or bot-check answer pauses requests for a while. It never tries to get past a block.
 */
export class ThreehentaiClient {
  private readonly gate = new Mutex();
  private readonly cache = new LruCache<string, CachedPage>(500);
  private readonly backoff: BlockBackoff;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly dispatcher: Dispatcher,
    private readonly options: ThreehentaiClientOptions,
  ) {
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.backoff = new BlockBackoff(this.now);
  }

  /** The HTML of an address on the site. Throws for addresses outside the allow-list. */
  page(address: string): Promise<string> {
    const url = new URL(address, THREEHENTAI_SITE);
    if (!isAllowedAddress(url)) throw HttpError.badRequest('This address is not part of the catalogue.');
    const key = url.href;
    const ttl = this.ttlFor(url);
    const fresh = this.freshCopy(key, ttl);
    if (fresh !== undefined) return Promise.resolve(fresh);
    return this.gate.run(async () => {
      const again = this.freshCopy(key, ttl);
      if (again !== undefined) return again;
      if (this.backoff.isPaused()) throw new HttpError(503, 'upstream', BUSY);
      const wait = this.lastAt + this.options.gapMs - this.now();
      if (wait > 0) await this.sleep(wait);
      this.lastAt = this.now();
      const res = await httpCall(this.dispatcher, {
        url: key,
        method: 'GET',
        headers: { 'User-Agent': APP_USER_AGENT, Accept: 'text/html' },
      });
      const html = await res.body.text();
      if (res.statusCode === 403 || res.statusCode === 429 || res.statusCode === 503 || CHALLENGE.test(html)) {
        this.backoff.block();
        throw new HttpError(503, 'upstream', BUSY);
      }
      if (res.statusCode === 404) throw HttpError.notFound();
      if (res.statusCode !== 200) {
        throw HttpError.upstream(res.statusCode, `3hentai.to returned ${res.statusCode}`);
      }
      this.backoff.reset();
      this.cache.set(key, { at: this.now(), html });
      return html;
    });
  }

  private ttlFor(url: URL): number {
    if (url.pathname.startsWith('/d/')) return this.options.galleryTtlMs;
    if (/^\/(?:tags|artists|characters|parodies|groups)\/?$/.test(url.pathname)) return this.options.indexTtlMs;
    return this.options.listingTtlMs;
  }

  private freshCopy(key: string, ttl: number): string | undefined {
    const hit = this.cache.get(key);
    if (hit === undefined || this.now() - hit.at >= ttl) return undefined;
    return hit.html;
  }
}
