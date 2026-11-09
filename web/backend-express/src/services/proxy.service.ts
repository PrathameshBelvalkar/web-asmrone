import type { Dispatcher } from 'undici';
import { httpCall, type HttpResult } from '../lib/http-client.js';
import { HttpError } from '../models/errors.js';
import type { IssuedUrls } from '../stores/issued-urls.js';

/**
 * Serves only URLs the extension has issued (exact match), so the proxy cannot be used as an
 * open proxy. Audio seeking sends Range requests, which are forwarded unchanged.
 */
export class ProxyService {
  constructor(
    private readonly issued: IssuedUrls,
    private readonly dispatcher: Dispatcher,
  ) {}

  /** Opens the upstream stream. The caller must consume or abort the body. */
  async open(url: string, range: string | undefined, signal: AbortSignal): Promise<HttpResult> {
    if (!this.issued.has(url)) throw HttpError.forbidden('URL was not issued by the extension');
    const res = await httpCall(this.dispatcher, {
      url,
      method: 'GET',
      headers: range === undefined ? {} : { Range: range },
      signal,
    });
    if (res.statusCode < 200 || res.statusCode >= 300) {
      res.body.dump().catch(() => undefined);
      throw HttpError.upstream(res.statusCode, `Upstream returned ${res.statusCode}`);
    }
    return res;
  }
}
