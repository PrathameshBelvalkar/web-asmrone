import type { Dispatcher } from 'undici';
import { BlockBackoff } from '../../lib/block-backoff.js';
import { httpCall } from '../../lib/http-client.js';
import { Mutex } from '../../lib/mutex.js';
import { HttpError } from '../../models/errors.js';
import { APP_USER_AGENT } from '../hanime/constants.js';
import { HENTAIBROS_SITEMAP_INDEX, POST_SLUG, postUrl } from './constants.js';
import { postSitemapsOf, postSlugsOf } from './parsers.js';

const CHALLENGE =
  /<title>Just a moment|<title>Attention Required|id="challenge-form"|cf-chl-widget|Verify you are human/;
const BUSY = 'hentaibros.net is limiting requests right now. Try again later.';

export interface HentaibrosClientOptions {
  /** The shortest gap between two requests. */
  readonly gapMs?: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * Reads hentaibros.net's post sitemaps and episode pages, one request at a time with a gap, with
 * Echo's own user agent. robots.txt allows everything. A block or bot check pauses requests for a
 * while; it never tries to get past one.
 */
export class HentaibrosClient {
  private readonly backoff: BlockBackoff;
  private readonly gate = new Mutex();
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private last = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly dispatcher: Dispatcher,
    private readonly options: HentaibrosClientOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.backoff = new BlockBackoff(this.now);
  }

  /** Every post slug, from the sitemap index's post sitemaps. */
  async postSlugs(): Promise<string[]> {
    const sitemaps = postSitemapsOf(await this.get(HENTAIBROS_SITEMAP_INDEX));
    if (sitemaps.length === 0) throw HttpError.upstream(502, 'hentaibros.net listed no posts.');
    const slugs: string[] = [];
    for (const url of sitemaps) slugs.push(...postSlugsOf(await this.get(url)));
    return [...new Set(slugs)];
  }

  /** An episode page. */
  episodePage(slug: string): Promise<string> {
    if (!POST_SLUG.test(slug)) throw HttpError.badRequest('This is not an episode.');
    return this.get(postUrl(slug));
  }

  private get(url: string): Promise<string> {
    return this.gate.run(async () => {
      if (this.backoff.isPaused()) throw new HttpError(503, 'upstream', BUSY);
      const wait = this.last + (this.options.gapMs ?? 0) - this.now();
      if (wait > 0) await this.sleep(wait);
      this.last = this.now();
      const res = await httpCall(this.dispatcher, {
        url,
        method: 'GET',
        headers: { 'User-Agent': APP_USER_AGENT, Accept: 'text/html,application/xml' },
      });
      const text = await res.body.text();
      if (
        res.statusCode === 403 ||
        res.statusCode === 429 ||
        res.statusCode === 503 ||
        res.headers['cf-mitigated'] === 'challenge' ||
        CHALLENGE.test(text.slice(0, 4000))
      ) {
        this.backoff.block();
        throw new HttpError(503, 'upstream', BUSY);
      }
      if (res.statusCode === 404) throw HttpError.notFound();
      if (res.statusCode !== 200) {
        throw HttpError.upstream(502, `hentaibros.net returned ${res.statusCode}`);
      }
      this.backoff.reset();
      return text;
    });
  }
}
