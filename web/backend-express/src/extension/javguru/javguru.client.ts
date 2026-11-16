import type { Dispatcher } from 'undici';
import { BlockBackoff } from '../../lib/block-backoff.js';
import { httpCall, type HttpResult } from '../../lib/http-client.js';
import { Mutex } from '../../lib/mutex.js';
import { HttpError } from '../../models/errors.js';
import { APP_USER_AGENT, JAVGURU_SITE } from './constants.js';
import { POST_PATH } from './parsers.js';

export interface JavguruClientOptions {
  /** Minimum gap between two requests to jav.guru, and between two to the embed host. */
  readonly siteGapMs: number;
  readonly embedGapMs: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

/** Cloudflare's check page. The background `challenge-platform` script on normal pages isn't one. */
const CHALLENGE = /<title>Just a moment|id="challenge-form"|cf-chl-widget/;
const BUSY = 'The stream source is limiting requests right now. Try again later.';
const EMBED_PATH = /^\/e\/[a-z0-9]{8,16}$/i;

/** One site's request lane: one request at a time, a gap between them, and a pause after a block. */
class Lane {
  private readonly gate = new Mutex();
  private readonly backoff: BlockBackoff;
  private lastAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly gapMs: number,
    private readonly now: () => number,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {
    this.backoff = new BlockBackoff(now);
  }

  /** Runs one request. A block or bot-check answer pauses the lane and throws 503. */
  run(
    send: () => Promise<HttpResult>,
  ): Promise<{ status: number; headers: HttpResult['headers']; text: string }> {
    return this.gate.run(async () => {
      if (this.backoff.isPaused()) throw new HttpError(503, 'upstream', BUSY);
      const wait = this.lastAt + this.gapMs - this.now();
      if (wait > 0) await this.sleep(wait);
      this.lastAt = this.now();
      const res = await send();
      const text = await res.body.text();
      if (
        res.statusCode === 403 ||
        res.statusCode === 429 ||
        res.statusCode === 503 ||
        res.headers['cf-mitigated'] === 'challenge' ||
        CHALLENGE.test(text)
      ) {
        this.backoff.block();
        throw new HttpError(503, 'upstream', BUSY);
      }
      this.backoff.reset();
      return { status: res.statusCode, headers: res.headers, text };
    });
  }
}

/**
 * Client for jav.guru and its STREAM SB embed host. It finds posts through the REST API (the site's
 * `/?s=` search is rate-limited), reads posts, reads one gateway redirect when needed, and reads
 * embed pages. Requests are spaced out, nothing is retried, and a block or bot check pauses all
 * requests to that site. It never tries to get past a block.
 *
 * The dispatcher must not follow redirects: the gateway's answer is the redirect itself.
 */
export class JavguruClient {
  private readonly site: Lane;
  private readonly embedLane: Lane;

  constructor(
    private readonly dispatcher: Dispatcher,
    options: JavguruClientOptions,
  ) {
    const now = options.now ?? Date.now;
    const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.site = new Lane(options.siteGapMs, now, sleep);
    this.embedLane = new Lane(options.embedGapMs, now, sleep);
  }

  /** The REST API's post search for a DVD ID: id, link and title of up to 10 posts. */
  async search(dvdId: string): Promise<unknown> {
    const url = new URL('/wp-json/wp/v2/posts', JAVGURU_SITE);
    url.searchParams.set('search', dvdId);
    url.searchParams.set('_fields', 'id,link,title');
    url.searchParams.set('per_page', '10');
    const res = await this.site.run(() => this.get(url, { Accept: 'application/json' }));
    if (res.status !== 200) throw HttpError.upstream(res.status, `jav.guru returned ${res.status}`);
    try {
      return JSON.parse(res.text) as unknown;
    } catch {
      throw HttpError.upstream(502, 'jav.guru search did not answer with JSON');
    }
  }

  /** A post's HTML. Only `/{id}/{slug}/` addresses on the site are read. */
  async post(address: string): Promise<string> {
    const url = new URL(address);
    if (url.origin !== JAVGURU_SITE || !POST_PATH.test(url.pathname) || url.search !== '') {
      throw HttpError.badRequest('This address is not a jav.guru post.');
    }
    const res = await this.site.run(() => this.get(url, { Accept: 'text/html' }));
    if (res.status === 404 || (res.status >= 300 && res.status < 400)) throw HttpError.notFound();
    if (res.status !== 200) throw HttpError.upstream(res.status, `jav.guru returned ${res.status}`);
    return res.text;
  }

  /**
   * Where the gateway sends a STREAM SB token (`/searcho/?xr={value}`): the embed address, or null
   * when it doesn't answer with an embed. robots.txt disallows `/searcho/`, so the service calls this
   * only when the known embed host has stopped working.
   */
  async gateway(value: string): Promise<URL | null> {
    if (!/^[0-9a-f]{16,32}$/i.test(value)) throw HttpError.badRequest('Not a gateway value.');
    const url = new URL('/searcho/', JAVGURU_SITE);
    url.searchParams.set('xr', value);
    const res = await this.site.run(() => this.get(url, { Accept: 'text/html' }));
    const location = res.headers.location;
    if (res.status < 300 || res.status >= 400 || typeof location !== 'string') return null;
    try {
      const target = new URL(location, url);
      return target.protocol === 'https:' && EMBED_PATH.test(target.pathname) ? target : null;
    } catch {
      return null;
    }
  }

  /** An embed page, asked for with the site as Referer (without it the host leaves the player out). */
  async embed(url: URL): Promise<{ status: number; html: string }> {
    if (url.protocol !== 'https:' || !EMBED_PATH.test(url.pathname)) {
      throw HttpError.badRequest('Not an embed address.');
    }
    const res = await this.embedLane.run(() =>
      this.get(url, { Accept: 'text/html', Referer: `${JAVGURU_SITE}/` }),
    );
    return { status: res.status, html: res.text };
  }

  private get(url: URL, headers: Record<string, string>): Promise<HttpResult> {
    return httpCall(this.dispatcher, {
      url,
      method: 'GET',
      headers: { 'User-Agent': APP_USER_AGENT, ...headers },
    });
  }
}
