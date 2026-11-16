import type { Dispatcher } from 'undici';
import { BlockBackoff } from '../../../lib/block-backoff.js';
import { LruCache } from '../../../lib/lru-cache.js';
import { Mutex } from '../../../lib/mutex.js';
import { httpCall } from '../../../lib/http-client.js';
import { HttpError } from '../../../models/errors.js';
import { JAV_IDOL_FACETS } from '../../../models/jav.js';
import { APP_USER_AGENT, JAVDATABASE_SITE } from '../constants.js';

export interface JavdatabaseClientOptions {
  /** Minimum gap between two requests to the site. */
  readonly gapMs: number;
  /** How long a page is kept, by kind of page. */
  readonly listingTtlMs: number;
  readonly detailTtlMs: number;
  readonly staticTtlMs: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

interface CachedPage {
  readonly at: number;
  readonly html: string;
}

/**
 * Every page loads Cloudflare's background bot script (`/cdn-cgi/challenge-platform/…`) and movie
 * pages load Turnstile for the comment form, so those alone don't mean a block. A real check page
 * says "Just a moment" or carries the challenge form.
 */
const CHALLENGE = /<title>Just a moment|id="challenge-form"|cf-chl-widget/;
const SLUG = '[a-z0-9][a-z0-9%._-]*';
const PAGE = '(?:page\\/\\d{1,6}\\/)?';
const PATHS = [
  `\\/${PAGE}`,
  `\\/blog\\/`,
  `\\/category\\/${SLUG}\\/${PAGE}`,
  `\\/\\d{4}\\/\\d{2}\\/\\d{2}\\/${SLUG}\\/`,
  `\\/(?:movies|uncensored|idols)\\/${PAGE}`,
  `\\/(?:movies|uncensored|idols)\\/${SLUG}\\/`,
  `\\/genres\\/`,
  `\\/(?:genres|studios|directors)\\/${SLUG}\\/${PAGE}`,
];
const PATH_OK = new RegExp(`^(?:${PATHS.join('|')})$`, 'i');
const NUMBER = /^\d{1,6}$/;
const RANGE = /^\d{4}\.00,\d{4}\.00$/;
const POST_TYPES = new Set(['movies,uncensored', 'movies', 'uncensored', 'idols']);
const SORTS = new Set(['oldest', 'top_rated', 'most_favorited', 'newest']);
const BUSY = 'javdatabase.com is limiting requests right now. Try again later.';

/**
 * Only these addresses are ever requested: the blog and its posts, the movie, idol, genre, studio
 * and director pages, and search, with their paging, sort and idol filter options. Anything else
 * (the REST API, admin-ajax, login, comments, favourites) is refused before a request is made.
 */
export function isAllowedAddress(url: URL): boolean {
  if (url.origin !== JAVDATABASE_SITE) return false;
  if (!PATH_OK.test(url.pathname) || url.pathname.includes('..')) return false;
  // Search lives at the site root (`/?s=…`, `/page/2/?s=…`); the root is allowed for nothing else.
  const isRoot = /^\/(?:page\/\d+\/)?$/.test(url.pathname);
  const isIdols = /^\/idols\/(?:page\/\d+\/)?$/.test(url.pathname);
  if (isRoot && !url.searchParams.has('s')) return false;
  for (const [key, value] of url.searchParams) {
    if (key === 's' && isRoot && value.length <= 200) continue;
    if (key === 'post_type' && isRoot && POST_TYPES.has(value)) continue;
    if ((key === 'paged' || key === 'ipage') && NUMBER.test(value)) continue;
    if (key === '_sort_' && SORTS.has(value)) continue;
    if (isIdols && key.startsWith('_') && isAllowedFacet(key.slice(1), value)) continue;
    if (isIdols && key === '_debut_year' && RANGE.test(value)) continue;
    return false;
  }
  return true;
}

function isAllowedFacet(name: string, value: string): boolean {
  if (!Object.hasOwn(JAV_IDOL_FACETS, name)) return false;
  const allowed: readonly string[] = JAV_IDOL_FACETS[name as keyof typeof JAV_IDOL_FACETS];
  return value.split(',').every((v) => allowed.includes(v));
}

/**
 * HTML client for javdatabase.com. Requests run one at a time with a gap between them, pages are
 * cached, and a block or bot-check answer pauses requests for a while. It never tries to get past a block.
 */
export class JavdatabaseClient {
  private readonly gate = new Mutex();
  private readonly cache = new LruCache<string, CachedPage>(500);
  private readonly backoff: BlockBackoff;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly dispatcher: Dispatcher,
    private readonly options: JavdatabaseClientOptions,
  ) {
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.backoff = new BlockBackoff(this.now);
  }

  /** The HTML of an address on the site. Throws for addresses outside the allow-list. */
  page(address: string): Promise<string> {
    const url = new URL(address, JAVDATABASE_SITE);
    if (!isAllowedAddress(url))
      throw HttpError.badRequest('This address is not part of the catalogue.');
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
      const mitigated = res.headers['cf-mitigated'] === 'challenge';
      if (
        res.statusCode === 403 ||
        res.statusCode === 429 ||
        res.statusCode === 503 ||
        mitigated ||
        CHALLENGE.test(html)
      ) {
        this.backoff.block();
        throw new HttpError(503, 'upstream', BUSY);
      }
      if (res.statusCode === 404) throw HttpError.notFound();
      if (res.statusCode !== 200) {
        throw HttpError.upstream(res.statusCode, `javdatabase.com returned ${res.statusCode}`);
      }
      this.backoff.reset();
      this.cache.set(key, { at: this.now(), html });
      return html;
    });
  }

  private ttlFor(url: URL): number {
    const path = url.pathname;
    if (path === '/genres/' || /^\/\d{4}\//.test(path)) return this.options.staticTtlMs;
    if (/^\/(?:movies|uncensored|idols)\/(?!page\/)[^/]+\/$/.test(path))
      return this.options.detailTtlMs;
    return this.options.listingTtlMs;
  }

  private freshCopy(key: string, ttl: number): string | undefined {
    const hit = this.cache.get(key);
    if (hit === undefined || this.now() - hit.at >= ttl) return undefined;
    return hit.html;
  }
}
