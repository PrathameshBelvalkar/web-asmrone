import type { Dispatcher } from 'undici';
import { BlockBackoff } from '../../../lib/block-backoff.js';
import { LruCache } from '../../../lib/lru-cache.js';
import { Mutex } from '../../../lib/mutex.js';
import { httpCall } from '../../../lib/http-client.js';
import { HttpError } from '../../../models/errors.js';
import { APP_USER_AGENT, HASMR_SITE } from '../constants.js';

export interface HasmrClientOptions {
  /** Minimum gap between two requests to the site (the site asks for none; we are polite). */
  readonly gapMs: number;
  readonly cacheTtlMs: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

interface CachedPage {
  readonly at: number;
  readonly html: string;
}

const CHALLENGE = /cdn-cgi\/challenge-platform|Just a moment/;
const PATH_OK =
  /^\/(?:page\/\d+\/?|rj\d+\.html|(?:category|tag|actor)\/[^/]+\/?(?:page\/\d+\/?)?|tags\/?|voice-actors\/?|%E4%BB%8A%E9%80%B1%E4%BA%BA%E6%B0%97%E3%81%AE\/?)?$/i;
const FILTERS = new Set(['latest', 'popular', 'most-viewed']);

/**
 * Only these addresses are ever requested: listings, work pages, tags, actors and search. Anything
 * else (including the site's hidden "honeypot" pages) is refused before a request is made.
 */
export function isAllowedAddress(url: URL): boolean {
  if (url.origin !== HASMR_SITE) return false;
  if (/honeypot/i.test(url.pathname)) return false;
  if (!PATH_OK.test(url.pathname)) return false;
  for (const [key, value] of url.searchParams) {
    if (key === 'filter' && FILTERS.has(value)) continue;
    if (key === 's' || key === 'page') continue;
    return false;
  }
  return true;
}

/**
 * HTML client for hentaiasmr.moe. Requests run one at a time with a gap between them, pages are
 * cached, and a block or bot-check answer pauses requests for a while. It never tries to get past a
 * block.
 */
export class HasmrClient {
  private readonly gate = new Mutex();
  private readonly cache = new LruCache<string, CachedPage>(300);
  private readonly backoff: BlockBackoff;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly dispatcher: Dispatcher,
    private readonly options: HasmrClientOptions,
  ) {
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.backoff = new BlockBackoff(this.now);
  }

  /** The HTML of an address on the site. Throws for addresses outside the allow-list. */
  page(address: string): Promise<string> {
    const url = new URL(address, HASMR_SITE);
    if (!isAllowedAddress(url))
      throw HttpError.badRequest('This address is not part of the catalogue.');
    const key = url.href;
    const fresh = this.freshCopy(key);
    if (fresh !== undefined) return Promise.resolve(fresh);
    return this.gate.run(async () => {
      const again = this.freshCopy(key);
      if (again !== undefined) return again;
      if (this.backoff.isPaused()) {
        throw new HttpError(
          503,
          'upstream',
          'hentaiasmr.moe is limiting requests right now. Try again later.',
        );
      }
      const wait = this.lastAt + this.options.gapMs - this.now();
      if (wait > 0) await this.sleep(wait);
      this.lastAt = this.now();
      const res = await httpCall(this.dispatcher, {
        url: key,
        method: 'GET',
        headers: { 'User-Agent': APP_USER_AGENT, Accept: 'text/html' },
      });
      const html = await res.body.text();
      if (
        res.statusCode === 403 ||
        res.statusCode === 429 ||
        res.statusCode === 503 ||
        CHALLENGE.test(html)
      ) {
        this.backoff.block();
        throw new HttpError(
          503,
          'upstream',
          'hentaiasmr.moe is limiting requests right now. Try again later.',
        );
      }
      if (res.statusCode !== 200) {
        throw HttpError.upstream(res.statusCode, `hentaiasmr.moe returned ${res.statusCode}`);
      }
      this.backoff.reset();
      this.cache.set(key, { at: this.now(), html });
      return html;
    });
  }

  private freshCopy(key: string): string | undefined {
    const hit = this.cache.get(key);
    if (hit === undefined || this.now() - hit.at >= this.options.cacheTtlMs) return undefined;
    return hit.html;
  }
}
