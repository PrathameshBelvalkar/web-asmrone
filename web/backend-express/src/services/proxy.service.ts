import type { Dispatcher } from 'undici';
import { httpCall, type HttpResult } from '../lib/http-client.js';
import { isHlsPlaylist, rewriteHlsPlaylist } from '../lib/hls.js';
import { HttpError } from '../models/errors.js';
import type { IssuedUrls } from '../stores/issued-urls.js';

/** Path of the proxy endpoint, as the browser calls it (the API is mounted under /api). */
const PROXY_PATH = '/api/proxy';

/**
 * Serves only URLs the extension has issued (exact match), so the proxy cannot be used as an
 * open proxy. Each issued URL carries the headers it needs upstream (for example a Referer).
 * Audio seeking sends Range requests, which are forwarded unchanged.
 */
export class ProxyService {
  constructor(
    private readonly issued: IssuedUrls,
    private readonly dispatcher: Dispatcher,
  ) {}

  /** Opens the upstream stream. The caller must consume or abort the body. */
  async open(url: string, range: string | undefined, signal: AbortSignal): Promise<HttpResult> {
    const headers = this.issued.headersOf(url);
    if (headers === undefined) throw HttpError.forbidden('URL was not issued by the extension');
    const res = await httpCall(this.dispatcher, {
      url,
      method: 'GET',
      headers: range === undefined ? { ...headers } : { ...headers, Range: range },
      signal,
    });
    if (res.statusCode < 200 || res.statusCode >= 300) {
      res.body.dump().catch(() => undefined);
      throw HttpError.upstream(res.statusCode, `Upstream returned ${res.statusCode}`);
    }
    return res;
  }

  /** True when an upstream response is an HLS playlist (its body must be rewritten, not streamed). */
  isPlaylist(url: string, contentType: unknown): boolean {
    return isHlsPlaylist(url, contentType);
  }

  /**
   * Rewrites an HLS playlist so each segment is fetched through the proxy. Each segment URL is
   * issued with the playlist's headers.
   */
  rewritePlaylist(playlistUrl: string, text: string): string {
    const headers = this.issued.headersOf(playlistUrl) ?? {};
    return rewriteHlsPlaylist(text, playlistUrl, (absolute) => {
      this.issued.add(absolute, headers);
      return `${PROXY_PATH}?url=${encodeURIComponent(absolute)}`;
    });
  }
}
