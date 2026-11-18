import { promisify } from 'node:util';
import { brotliDecompress, gunzip, inflate } from 'node:zlib';
import type { Dispatcher } from 'undici';
import { BlockBackoff } from '../../lib/block-backoff.js';
import { httpCall } from '../../lib/http-client.js';
import { Mutex } from '../../lib/mutex.js';
import { HttpError } from '../../models/errors.js';
import {
  APP_USER_AGENT,
  HANIME_CATALOG_HOSTS,
  HANIME_CATALOG_URL,
  HANIME_SITE,
  HANIME_SITEMAP_URL,
} from './constants.js';

const gunzipAsync = promisify(gunzip);
const inflateAsync = promisify(inflate);
const brotliAsync = promisify(brotliDecompress);

/** A real check page says "Just a moment" or carries the challenge form. */
const CHALLENGE =
  /<title>Just a moment|<title>Attention Required|id="challenge-form"|cf-chl-widget/;
const BUSY = 'hanime is limiting requests right now. NekoHub keeps its copy and tries again later.';

export interface HanimeClientOptions {
  /** The shortest gap between two page requests (title pages, Browse). */
  readonly pageGapMs?: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/;

/**
 * Downloads hanime's catalog and sitemap, and reads a title's page and the Browse page. Only those
 * addresses (and the home page, to find a moved catalog) are ever requested, never with a query
 * string: a query string skips Cloudflare's cache. Pages are read one at a time with a gap between
 * them. A block or bot-check answer pauses requests for a while. It never tries to get past a block.
 */
export class HanimeClient {
  private readonly backoff: BlockBackoff;
  private readonly gate = new Mutex();
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastPageAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly dispatcher: Dispatcher,
    private readonly options: HanimeClientOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.backoff = new BlockBackoff(this.now);
  }

  isPaused(): boolean {
    return this.backoff.isPaused();
  }

  /** The catalog answer's text. 404 throws `HttpError.notFound()` so the caller can look for a new address. */
  catalog(url: string = HANIME_CATALOG_URL): Promise<string> {
    if (!isCatalogAddress(url)) throw HttpError.badRequest('This address is not hanime’s catalog.');
    return this.get(url, 'application/json');
  }

  /** The `/videos/hentai/{slug}` slugs the sitemap lists. */
  async sitemapSlugs(): Promise<string[]> {
    const xml = await this.get(HANIME_SITEMAP_URL, 'application/xml');
    return [...xml.matchAll(/<loc>https:\/\/hanime\.tv\/videos\/hentai\/([^<\s/]+)<\/loc>/g)].map(
      (m) => m[1] as string,
    );
  }

  /** A title's page (`/videos/hentai/{slug}`): the storyboard, length, badges and other names. */
  titlePage(slug: string): Promise<string> {
    if (!SLUG.test(slug)) throw HttpError.badRequest('This is not a title.');
    return this.page(`${HANIME_SITE}/videos/hentai/${slug}`);
  }

  /** The Browse page: the tags' pictures and descriptions. */
  browsePage(): Promise<string> {
    return this.page(`${HANIME_SITE}/browse`);
  }

  private page(url: string): Promise<string> {
    return this.gate.run(async () => {
      const wait = this.lastPageAt + (this.options.pageGapMs ?? 0) - this.now();
      if (wait > 0) await this.sleep(wait);
      this.lastPageAt = this.now();
      return this.get(url, 'text/html');
    });
  }

  /** The catalog address the home page names now (`window.AppConfig.search_hvs_url`), if it's allowed. */
  async discoverCatalogUrl(): Promise<string | null> {
    const html = await this.get(`${HANIME_SITE}/`, 'text/html');
    const match = /"search_hvs_url"\s*:\s*"([^"]+)"/.exec(html);
    const url = match?.[1]?.replace(/\\\//g, '/');
    return url !== undefined && isCatalogAddress(url) ? url : null;
  }

  private async get(url: string, accept: string): Promise<string> {
    if (this.backoff.isPaused()) throw new HttpError(503, 'upstream', BUSY);
    const res = await httpCall(this.dispatcher, {
      url,
      method: 'GET',
      headers: { 'User-Agent': APP_USER_AGENT, Accept: accept, 'Accept-Encoding': 'gzip, br' },
    });
    const bytes = Buffer.from(await res.body.arrayBuffer());
    const text = await decode(bytes, res.headers['content-encoding'], url);
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
    if (res.statusCode !== 200) throw HttpError.upstream(502, `hanime returned ${res.statusCode}`);
    this.backoff.reset();
    return text;
  }
}

/** The catalog may only be read from an https address on an allowed host, without a query string. */
export function isCatalogAddress(address: string): boolean {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    HANIME_CATALOG_HOSTS.includes(url.hostname) &&
    url.search === '' &&
    url.hash === '' &&
    /^\/api\/v\d+\/search_hvs$/.test(url.pathname)
  );
}

async function decode(bytes: Buffer, encoding: unknown, url: string): Promise<string> {
  const enc = typeof encoding === 'string' ? encoding.toLowerCase() : '';
  let out = bytes;
  if (enc.includes('br')) out = await brotliAsync(bytes);
  else if (enc.includes('gzip')) out = await gunzipAsync(bytes);
  else if (enc.includes('deflate')) out = await inflateAsync(bytes);
  // The sitemap is a .gz file served as-is.
  if (url.endsWith('.gz') && out[0] === 0x1f && out[1] === 0x8b) out = await gunzipAsync(out);
  return out.toString('utf8');
}
