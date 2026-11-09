import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDispatcher } from '../../src/lib/http-client.js';
import { serverMedia } from '../../src/models/echo/streamable.js';
import { createFakeExtension } from '../helpers/fake-extension.js';
import { makeTestApp, type TestApp } from '../helpers/app.js';

const BODY = Buffer.from(Array.from({ length: 4000 }, (_, i) => i % 251));
let upstream: Server;
let base = '';
let app: TestApp;
let proxyDispatcher: ReturnType<typeof createDispatcher>;

beforeAll(async () => {
  upstream = createServer((req, res) => {
    if (req.url === '/moved') {
      res.writeHead(302, { Location: '/audio.bin' }).end();
      return;
    }
    if (req.url === '/missing') {
      res.writeHead(404).end('nope');
      return;
    }
    const range = req.headers.range;
    if (range) {
      const match = /bytes=(\d+)-(\d+)/.exec(range);
      const start = Number(match?.[1]);
      const end = Number(match?.[2]);
      const slice = BODY.subarray(start, end + 1);
      res.writeHead(206, {
        'Content-Type': 'audio/wav',
        'Content-Range': `bytes ${start}-${end}/${BODY.length}`,
        'Content-Length': String(slice.length),
      });
      res.end(slice);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': String(BODY.length) });
    res.end(BODY);
  });
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  proxyDispatcher = createDispatcher({ connectMs: 5_000, responseMs: 5_000 });
  const extension = createFakeExtension({
    loadStreamableMedia: vi.fn((s: { id: string }) => Promise.resolve(serverMedia(s.id))),
  });
  app = await makeTestApp({ extension, proxyDispatcher });
});

afterAll(async () => {
  await app.cleanup();
  await proxyDispatcher.close();
  await new Promise<void>((resolve) => {
    upstream.close(() => {
      resolve();
    });
  });
});

/** Issues `url` through the track-media route, the only way the extension hands out URLs. */
async function issue(url: string): Promise<void> {
  const item = {
    mediaItemType: 'dev.brahmkshatriya.echo.common.models.Track',
    id: 'h',
    title: 't',
    streamables: [{ id: url, quality: 1, type: 'Server', title: null, extras: {} }],
    extras: {},
  };
  await request(app.app).post('/api/track/media').send({ item }).expect(200);
}

describe('media proxy', () => {
  it('serves an issued URL with a Range request as 206 with the right bytes', async () => {
    await issue(`${base}/audio.bin`);
    const res = await request(app.app)
      .get('/api/proxy')
      .query({ url: `${base}/audio.bin` })
      .set('Range', 'bytes=10-19')
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => {
          chunks.push(c);
        });
        r.on('end', () => {
          cb(null, Buffer.concat(chunks));
        });
      })
      .expect(206);
    expect(res.headers['content-range']).toBe(`bytes 10-19/${BODY.length}`);
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['content-type']).toMatch(/audio\/wav/);
    expect((res.body as Buffer).equals(BODY.subarray(10, 20))).toBe(true);
  });

  it('serves a full response when there is no Range header', async () => {
    await issue(`${base}/audio.bin`);
    const res = await request(app.app).get('/api/proxy').query({ url: `${base}/audio.bin` }).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => {
        chunks.push(c);
      });
      r.on('end', () => {
          cb(null, Buffer.concat(chunks));
        });
    }).expect(200);
    expect((res.body as Buffer).length).toBe(BODY.length);
  });

  it('follows redirects on the upstream host', async () => {
    await issue(`${base}/moved`);
    const res = await request(app.app).get('/api/proxy').query({ url: `${base}/moved` }).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => {
        chunks.push(c);
      });
      r.on('end', () => {
          cb(null, Buffer.concat(chunks));
        });
    }).expect(200);
    expect((res.body as Buffer).length).toBe(BODY.length);
  });

  it('passes an upstream error status through as a JSON error', async () => {
    await issue(`${base}/missing`);
    const res = await request(app.app).get('/api/proxy').query({ url: `${base}/missing` }).expect(404);
    expect(res.body).toEqual({ type: 'upstream', message: 'Upstream returned 404' });
  });

  it('refuses a URL the extension did not issue', async () => {
    const res = await request(app.app).get('/api/proxy').query({ url: 'https://example.com/x.mp3' }).expect(403);
    expect(res.body).toEqual({ type: 'forbidden', message: 'URL was not issued by the extension' });
  });

  it('requires a url parameter', async () => {
    const res = await request(app.app).get('/api/proxy').expect(400);
    expect(res.body).toEqual({ type: 'bad_request', message: 'url is required' });
  });
});
