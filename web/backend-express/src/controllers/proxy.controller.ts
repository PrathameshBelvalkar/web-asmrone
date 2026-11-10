import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { HttpError } from '../models/errors.js';
import type { ProxyService } from '../services/proxy.service.js';
import { queryString } from './query.js';

/** Streams an issued upstream URL. HLS playlists are rewritten so their segments also go through here. */
export class ProxyController {
  constructor(private readonly proxy: ProxyService) {}

  stream = async (req: Request, res: Response): Promise<void> => {
    const url = queryString(req, 'url');
    if (url === undefined) throw HttpError.badRequest('url is required');

    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });

    const range = req.headers.range;
    const upstream = await this.proxy.open(url, range, abort.signal);

    if (this.proxy.isPlaylist(url, upstream.headers['content-type'])) {
      const text = await upstream.body.text();
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(this.proxy.rewritePlaylist(url, text));
      return;
    }

    const contentRange = upstream.headers['content-range'];
    const contentLength = upstream.headers['content-length'];
    const contentType = upstream.headers['content-type'];
    if (contentRange !== undefined) res.setHeader('Content-Range', String(contentRange));
    if (contentLength !== undefined) res.setHeader('Content-Length', String(contentLength));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', typeof contentType === 'string' ? contentType : 'application/octet-stream');
    res.status(upstream.statusCode);

    try {
      await pipeline(upstream.body, res);
    } catch (err) {
      // A client that goes away mid-stream is normal (seeking, navigation).
      if (!abort.signal.aborted) throw err;
    }
  };
}
