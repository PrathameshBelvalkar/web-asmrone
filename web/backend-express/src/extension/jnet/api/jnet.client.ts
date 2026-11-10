import type { Dispatcher } from 'undici';
import { LruCache } from '../../../lib/lru-cache.js';
import { Mutex } from '../../../lib/mutex.js';
import { httpCall } from '../../../lib/http-client.js';
import { HttpError } from '../../../models/errors.js';
import { BlockBackoff } from '../../../lib/block-backoff.js';
import { APP_USER_AGENT, JNET_SITE } from '../constants.js';

export interface JnetClientOptions {
  /** Minimum gap between two requests to the site. */
  readonly gapMs: number;
  /** How long a response is reused. */
  readonly cacheTtlMs: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

interface CachedJson {
  readonly at: number;
  readonly body: unknown;
}

/**
 * JSON API client for jasmr.net. One request at a time with a gap between them, responses cached,
 * and a pause when the site answers with a block or bot-check page (never a way around it).
 */
export class JnetClient {
  private readonly gate = new Mutex();
  private readonly cache = new LruCache<string, CachedJson>(500);
  private lastAt = Number.NEGATIVE_INFINITY;
  private readonly backoff: BlockBackoff;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly dispatcher: Dispatcher,
    private readonly options: JnetClientOptions,
  ) {
    this.now = options.now ?? Date.now;
    this.backoff = new BlockBackoff(this.now);
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /** The parsed JSON at an API path such as `/api/v1/home`. */
  json(path: string, options: { readonly cacheTtlMs?: number } = {}): Promise<unknown> {
    const url = new URL(path, JNET_SITE).href;
    const ttl = options.cacheTtlMs ?? this.options.cacheTtlMs;
    const fresh = this.freshCopy(url, ttl);
    if (fresh !== undefined) return Promise.resolve(fresh);
    return this.gate.run(async () => {
      const again = this.freshCopy(url, ttl);
      if (again !== undefined) return again;
      if (this.backoff.isPaused()) {
        throw new HttpError(
          503,
          'upstream',
          'jasmr.net is limiting requests right now. Try again later.',
        );
      }
      await this.waitForTurn();
      this.lastAt = this.now();
      const res = await httpCall(this.dispatcher, {
        url,
        method: 'GET',
        headers: { 'User-Agent': APP_USER_AGENT, Accept: 'application/json' },
      });
      const text = await res.body.text();
      const isJson = /application\/json/.test(String(res.headers['content-type'] ?? ''));
      if (
        res.statusCode === 403 ||
        res.statusCode === 429 ||
        res.statusCode === 503 ||
        (!isJson && res.statusCode === 200)
      ) {
        this.backoff.block();
        throw new HttpError(
          503,
          'upstream',
          'jasmr.net is limiting requests right now. Try again later.',
        );
      }
      if (res.statusCode !== 200) {
        throw HttpError.upstream(res.statusCode, `jasmr.net returned ${res.statusCode}`);
      }
      const body = JSON.parse(text) as unknown;
      this.backoff.reset();
      this.cache.set(url, { at: this.now(), body });
      return body;
    });
  }

  private freshCopy(url: string, ttlMs: number): unknown {
    const hit = this.cache.get(url);
    if (hit === undefined || this.now() - hit.at >= ttlMs) return undefined;
    return hit.body;
  }

  private async waitForTurn(): Promise<void> {
    const wait = this.lastAt + this.options.gapMs - this.now();
    if (wait > 0) await this.sleep(wait);
  }
}
