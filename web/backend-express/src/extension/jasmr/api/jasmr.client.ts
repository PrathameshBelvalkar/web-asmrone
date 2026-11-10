import type { Dispatcher } from 'undici';
import { LruCache } from '../../../lib/lru-cache.js';
import { Mutex } from '../../../lib/mutex.js';
import { httpCall } from '../../../lib/http-client.js';
import { HttpError } from '../../../models/errors.js';
import { JASMR_SITE, JASMR_USER_AGENT } from '../constants.js';

export interface JasmrClientOptions {
  /** Minimum gap between two page requests, from robots.txt (`Crawl-delay`). */
  readonly crawlDelayMs: number;
  /** How long a fetched page is reused. */
  readonly cacheTtlMs: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

interface CachedPage {
  readonly at: number;
  readonly html: string;
}

const CHALLENGE_MARKER = /cdn-cgi\/challenge-platform|Just a moment/;

/**
 * Fetches japaneseasmr.com pages as HTML. Requests run one at a time with at least `crawlDelayMs`
 * between them, and fetched pages are cached. A bot-check page from Cloudflare is reported as an
 * error; the client never tries to get around it.
 */
export class JasmrClient {
  private readonly gate = new Mutex();
  private readonly cache = new LruCache<string, CachedPage>(300);
  private lastRequestAt = Number.NEGATIVE_INFINITY;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly dispatcher: Dispatcher,
    private readonly options: JasmrClientOptions,
  ) {
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /** HTML of a site path such as `/` or `/page/2/`. */
  page(path: string): Promise<string> {
    const url = new URL(path, JASMR_SITE).href;
    const fresh = this.freshCopy(url);
    if (fresh !== undefined) return Promise.resolve(fresh);
    return this.gate.run(async () => {
      // Another request may have filled the cache while this one waited.
      const again = this.freshCopy(url);
      if (again !== undefined) return again;
      await this.waitForTurn();
      this.lastRequestAt = this.now();
      const res = await httpCall(this.dispatcher, {
        url,
        method: 'GET',
        headers: { 'User-Agent': JASMR_USER_AGENT, Accept: 'text/html' },
      });
      const html = await res.body.text();
      if ((res.statusCode === 403 || res.statusCode === 503) && CHALLENGE_MARKER.test(html)) {
        throw new HttpError(503, 'upstream', 'japaneseasmr.com is showing a bot check. Try again later.');
      }
      if (res.statusCode !== 200) {
        throw HttpError.upstream(res.statusCode, `japaneseasmr.com returned ${res.statusCode}`);
      }
      this.cache.set(url, { at: this.now(), html });
      return html;
    });
  }

  private freshCopy(url: string): string | undefined {
    const hit = this.cache.get(url);
    if (hit === undefined || this.now() - hit.at >= this.options.cacheTtlMs) return undefined;
    return hit.html;
  }

  private async waitForTurn(): Promise<void> {
    const wait = this.lastRequestAt + this.options.crawlDelayMs - this.now();
    if (wait > 0) await this.sleep(wait);
  }
}
