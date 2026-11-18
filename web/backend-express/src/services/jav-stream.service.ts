import { DEFAULT_EMBED_HOST, SERVERS, type JavguruServer } from '../extension/javguru/constants.js';
import type { JavguruClient } from '../extension/javguru/javguru.client.js';
import {
  embedLinks,
  postFor,
  serverButtons,
  type FoundPost,
} from '../extension/javguru/parsers.js';
import { fileIdOf, gatewayValue } from '../extension/javguru/token.js';
import { LruCache } from '../lib/lru-cache.js';
import { BLOCKED_JAV_TITLE } from '../lib/content-rules.js';
import { HttpError } from '../models/errors.js';
import type { JavKind, JavStream } from '../models/jav.js';
import type { IssuedUrls } from '../stores/issued-urls.js';
import type { JavService } from './jav.service.js';

export interface JavStreamServiceOptions {
  /** How long a DVD ID's post is remembered, and how long "no post" is. */
  readonly postTtlMs: number;
  readonly missTtlMs: number;
  /** How long a post's server tokens are remembered. */
  readonly serversTtlMs: number;
  /** How long a resolved stream is handed out again. Well inside the host's own expiry. */
  readonly streamTtlMs: number;
  readonly now?: () => number;
}

interface Timed<T> {
  readonly at: number;
  readonly value: T;
}

/**
 * Full-movie streams for the JAV section, from jav.guru's STREAM SB server (docs/JAV.md section 11).
 * A stream is resolved only when asked for: the movie (from javdatabase, with the content rules)
 * gives the DVD ID, the REST search gives the post, the post gives the server token, the token gives
 * the embed file id, and the embed page gives the HLS master playlist. Every step is cached.
 *
 * The master playlist is issued with direct segments: its playlists go through the proxy (the host
 * sends no CORS header), and the video segments load in the browser from their CDN.
 */
export class JavStreamService {
  private readonly posts = new LruCache<string, Timed<FoundPost | null>>(2_000);
  private readonly tokens = new LruCache<string, Timed<Partial<Record<JavguruServer, string>>>>(
    500,
  );
  private readonly streams = new LruCache<string, Timed<JavStream>>(200);
  private readonly pending = new Map<string, Promise<JavStream>>();
  private readonly now: () => number;
  /** The embed host STREAM SB sends to. Learned again from the gateway when it stops answering. */
  private embedHost = DEFAULT_EMBED_HOST;

  constructor(
    private readonly jav: JavService,
    private readonly client: JavguruClient,
    private readonly issued: IssuedUrls,
    private readonly options: JavStreamServiceOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  async stream(kind: JavKind, slug: string, server: JavguruServer): Promise<JavStream> {
    const movie = await this.jav.movie(kind, slug);
    if (movie.dvdId === null || movie.upcoming) throw noStream();
    const key = `${server}:${movie.dvdId.toUpperCase()}`;
    const cached = this.fresh(this.streams, key, this.options.streamTtlMs);
    if (cached !== undefined) return this.issue(cached.value);
    const running = this.pending.get(key);
    if (running !== undefined) return running;
    const task = this.resolve(movie.dvdId, server)
      .then((stream) => {
        this.streams.set(key, { at: this.now(), value: stream });
        return this.issue(stream);
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, task);
    return task;
  }

  private async resolve(dvdId: string, server: JavguruServer): Promise<JavStream> {
    const post = await this.postOf(dvdId);
    if (post === null) throw noStream();
    if (BLOCKED_JAV_TITLE.test(post.title)) {
      throw new HttpError(451, 'forbidden', 'This title is not available in NekoHub.');
    }
    const token = (await this.tokensOf(post.url))[server];
    if (token === undefined) throw noStream(`This movie has no ${SERVERS[server].label} stream.`);
    const fileId = fileIdOf(token);
    if (fileId === null) throw unavailable();
    const masters = await this.mastersOf(fileId, token);
    const master = masters[0];
    if (master === undefined) throw unavailable();
    return { server, master, expiresAt: this.now() + this.options.streamTtlMs };
  }

  private async postOf(dvdId: string): Promise<FoundPost | null> {
    const key = dvdId.toUpperCase();
    const hit = this.posts.get(key);
    if (hit !== undefined) {
      const ttl = hit.value === null ? this.options.missTtlMs : this.options.postTtlMs;
      if (this.now() - hit.at < ttl) return hit.value;
    }
    const post = postFor(await this.client.search(key), key);
    this.posts.set(key, { at: this.now(), value: post });
    return post;
  }

  private async tokensOf(postUrl: string): Promise<Partial<Record<JavguruServer, string>>> {
    const hit = this.fresh(this.tokens, postUrl, this.options.serversTtlMs);
    if (hit !== undefined) return hit.value;
    const tokens: Partial<Record<JavguruServer, string>> = {};
    for (const button of serverButtons(await this.client.post(postUrl))) {
      for (const [server, { label, param }] of Object.entries(SERVERS) as [
        JavguruServer,
        (typeof SERVERS)[JavguruServer],
      ][]) {
        const token = button.gateway.searchParams.get(param);
        if (button.label === label && token !== null && tokens[server] === undefined) {
          tokens[server] = token;
        }
      }
    }
    this.tokens.set(postUrl, { at: this.now(), value: tokens });
    return tokens;
  }

  /**
   * The master playlists for an embed file id. The known embed host is tried first; only when it
   * fails is the site's gateway asked where the file is now (robots.txt disallows the gateway).
   */
  private async mastersOf(fileId: string, token: string): Promise<string[]> {
    const known = new URL(`https://${this.embedHost}/e/${fileId}`);
    const first = await this.readEmbed(known);
    if (first !== null) return first;
    const target = await this.client.gateway(gatewayValue(token));
    if (target === null || target.href === known.href) return [];
    const moved = await this.readEmbed(target);
    if (moved !== null) this.embedHost = target.host;
    return moved ?? [];
  }

  private async readEmbed(url: URL): Promise<string[] | null> {
    const page = await this.client.embed(url);
    if (page.status !== 200) return null;
    return embedLinks(page.html, url.href)?.masters ?? null;
  }

  /** Lets the proxy serve the master playlist; its segments load directly. */
  private issue(stream: JavStream): JavStream {
    this.issued.add(stream.master, {}, { directSegments: true });
    return stream;
  }

  private fresh<T>(
    cache: LruCache<string, Timed<T>>,
    key: string,
    ttl: number,
  ): Timed<T> | undefined {
    const hit = cache.get(key);
    return hit !== undefined && this.now() - hit.at < ttl ? hit : undefined;
  }
}

const noStream = (message = 'No stream was found for this movie.'): HttpError =>
  new HttpError(404, 'not_found', message);

const unavailable = (): HttpError =>
  new HttpError(502, 'upstream', 'The stream could not be found on its host.');
