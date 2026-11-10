import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { MockAgent } from 'undici';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from '../helpers/app.js';
import { createFakeExtension } from '../helpers/fake-extension.js';

const POST_HTML = readFileSync(
  join(__dirname, '..', 'fixtures', 'jasmr', 'post-151994.html'),
  'utf8',
);
const LISTING_HTML = readFileSync(
  join(__dirname, '..', 'fixtures', 'jasmr', 'listing-page-2.html'),
  'utf8',
);
const M3U8 = 'https://v.weeab0o.xyz/RJ01755181.m3u8';
const SEGMENT = 'https://v.weeab0o.xyz/RJ01755181/RJ01755181_1003623376_000000.ts';
/** Cover of the first card on the listing fixture (work 151979). */
const LIST_COVER = 'https://pic.weeabo0.xyz/RJ01746828_img_main.jpg';
const REFERER = 'https://japaneseasmr.com/';

const indexEntry = (path: string, count: number, name: string) =>
  `<span class="tag-groups-tag"><a href="https://japaneseasmr.com${path}" title="(${count})"><span class="tag-groups-label">${name}</span></a></span>`;
const CV_HTML =
  indexEntry('/tag/kaede-akino/', 1054, 'Kaede Akino') +
  indexEntry('/tag/yuka-hinata/', 1233, 'Yuka Hinata');
const TAGS_HTML =
  indexEntry('/tag/18%e7%a6%81/', 19975, '18禁') +
  indexEntry('/tag/2023/', 5398, '2023') +
  indexEntry('/tag/binaural/', 10154, 'Binaural') +
  indexEntry('/tag/whispering/', 4680, 'Whispering');

const PLAYLIST =
  '#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:10.0,\nRJ01755181/RJ01755181_1003623376_000000.ts\n#EXT-X-ENDLIST\n';

/** japaneseasmr.com (HTML) and its CDNs. Each CDN answers only when the Referer is the site's. */
function mockSite(siteAgent: MockAgent, cdnAgent: MockAgent): void {
  const site = siteAgent.get('https://japaneseasmr.com');
  site.intercept({ path: '/', method: 'GET' }).reply(200, LISTING_HTML).persist();
  site.intercept({ path: '/151994/', method: 'GET' }).reply(200, POST_HTML).persist();
  // Index pages for the home screen's "top" rows. /circles/ shows a bot check, so that row is skipped.
  site.intercept({ path: '/cv/', method: 'GET' }).reply(200, CV_HTML).persist();
  site
    .intercept({ path: '/circles/', method: 'GET' })
    .reply(403, '<html>Just a moment... cdn-cgi/challenge-platform</html>')
    .persist();
  site.intercept({ path: '/tags/', method: 'GET' }).reply(200, TAGS_HTML).persist();

  const hosts = cdnAgent.get('https://v.weeab0o.xyz');
  hosts
    .intercept({ path: '/RJ01755181.m3u8', method: 'GET', headers: { referer: REFERER } })
    .reply(200, PLAYLIST, { headers: { 'content-type': 'application/vnd.apple.mpegurl' } })
    .persist();
  hosts
    .intercept({
      path: '/RJ01755181/RJ01755181_1003623376_000000.ts',
      method: 'GET',
      headers: { referer: REFERER },
    })
    .reply(200, Buffer.from('segment-bytes'), { headers: { 'content-type': 'video/mp2t' } })
    .persist();
  const images = cdnAgent.get('https://pic.weeabo0.xyz');
  for (const path of ['/RJ01755181_img_main.jpg', '/RJ01746828_img_main.jpg']) {
    images
      .intercept({ path, method: 'GET', headers: { referer: REFERER } })
      .reply(200, Buffer.from('jpeg'), { headers: { 'content-type': 'image/jpeg' } })
      .persist();
  }
}

const siteAgent = new MockAgent();
const cdnAgent = new MockAgent();
siteAgent.disableNetConnect();
cdnAgent.disableNetConnect();
mockSite(siteAgent, cdnAgent);

let t: TestApp;

beforeAll(async () => {
  t = await makeTestApp({
    extension: createFakeExtension(),
    jasmrDispatcher: siteAgent,
    proxyDispatcher: cdnAgent,
  });
});

afterAll(async () => {
  await t.cleanup();
  await siteAgent.close();
  await cdnAgent.close();
});

const album = {
  mediaItemType: 'dev.brahmkshatriya.echo.common.models.Album',
  id: 'jasmr:151994',
  title: 'x',
  extras: {},
};

describe('japaneseasmr through the API', () => {
  it('opens the home feed with the latest works, ratings and genres', async () => {
    const opened = await request(t.app).get('/api/home?source=jasmr').expect(200);
    const page = await request(t.app).get(`/api/pages/${opened.body.pagedId}`).expect(200);
    // The fixture page has no Featured box, so that row is left out.
    const [latest, ratings, genres] = page.body.items;
    expect(latest.kind).toBe('items');
    expect(latest.items.length).toBe(3);
    expect(latest.items[0].id).toBe('jasmr:151979');
    expect(ratings.categories.map((c: { id: string }) => c.id)).toEqual([
      'rating-sfw',
      'rating-r15',
      'rating-nsfw',
      'rating-r18g',
    ]);
    expect(genres.categories.map((c: { id: string }) => c.id)).toContain('yuri');
    expect(page.body.continuation).toBe('cv');
  });

  it('adds the top voice actors, circles and tags as the home feed pages on', async () => {
    const opened = await request(t.app).get('/api/home?source=jasmr').expect(200);
    const id = opened.body.pagedId as string;
    const cv = await request(t.app).get(`/api/pages/${id}?cont=cv`).expect(200);
    expect(cv.body.items[0].title).toBe('Top voice actors');
    expect(
      cv.body.items[0].categories.map((c: { title: string; subtitle: string }) => [
        c.title,
        c.subtitle,
      ]),
    ).toEqual([
      ['Yuka Hinata', '1233'],
      ['Kaede Akino', '1054'],
    ]);
    expect(cv.body.items[0].categories[0].feedId).toEqual(expect.any(String));
    expect(cv.body.continuation).toBe('circles');

    // The circles page shows a bot check: the row is skipped and the feed goes on.
    const circles = await request(t.app).get(`/api/pages/${id}?cont=circles`).expect(200);
    expect(circles.body.items).toEqual([]);
    expect(circles.body.continuation).toBe('tags');

    const tags = await request(t.app).get(`/api/pages/${id}?cont=tags`).expect(200);
    expect(tags.body.items[0].categories.map((c: { title: string }) => c.title)).toEqual([
      'Binaural',
      'Whispering',
    ]);
    expect(tags.body.continuation).toBeNull();
  });

  it('refuses an unknown source', async () => {
    const res = await request(t.app).get('/api/home?source=nope').expect(400);
    expect(res.body).toEqual({ type: 'bad_request', message: 'source must be asmrone or jasmr' });
  });

  it('loads a work with its chapters, each starting at its offset in the stream', async () => {
    const work = await request(t.app).post('/api/album/load').send({ item: album }).expect(200);
    expect(work.body.id).toBe('jasmr:151994');
    expect(work.body.title).toContain('リリィプリンセス');

    const tracks = await request(t.app).post('/api/album/tracks').send({ item: album }).expect(200);
    const page = await request(t.app).get(`/api/pages/${tracks.body.pagedId}`).expect(200);
    expect(page.body.items).toHaveLength(16);
    const second = page.body.items[1];
    expect(second.id).toBe('jasmr:151994#1');
    expect(second.extras).toMatchObject({ start: '265', end: '544' });
    expect(second.isPlayable.type).toMatch(/Playable\.Yes$/);
  });

  it('gives the HLS stream with the Referer the site needs, and proxies the playlist through the server', async () => {
    const tracks = await request(t.app).post('/api/album/tracks').send({ item: album }).expect(200);
    const page = await request(t.app).get(`/api/pages/${tracks.body.pagedId}`).expect(200);
    const media = await request(t.app)
      .post('/api/track/media')
      .send({ item: page.body.items[0] })
      .expect(200);
    const source = media.body.sources[0];
    expect(source.type).toBe('HLS');
    expect(source.request.url).toBe(M3U8);

    const playlist = await request(t.app)
      .get(`/api/proxy?url=${encodeURIComponent(M3U8)}`)
      .expect(200);
    expect(playlist.headers['content-type']).toMatch(/mpegurl/);
    expect(playlist.text).toContain(`/api/proxy?url=${encodeURIComponent(SEGMENT)}`);
    expect(playlist.text).not.toContain('https://v.weeab0o.xyz/RJ01755181/');
  });

  it('serves the rewritten segments and covers through the proxy with the Referer', async () => {
    // The app asks for the stream first (that issues the playlist), then fetches the playlist, which issues its segments.
    const tracks = await request(t.app).post('/api/album/tracks').send({ item: album }).expect(200);
    const first = await request(t.app).get(`/api/pages/${tracks.body.pagedId}`).expect(200);
    await request(t.app).post('/api/track/media').send({ item: first.body.items[0] }).expect(200);
    await request(t.app)
      .get(`/api/proxy?url=${encodeURIComponent(M3U8)}`)
      .expect(200);
    const segment = await request(t.app)
      .get(`/api/proxy?url=${encodeURIComponent(SEGMENT)}`)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          cb(null, Buffer.concat(chunks));
        });
      })
      .expect(200);
    expect(segment.headers['content-type']).toBe('video/mp2t');
    expect((segment.body as Buffer).toString()).toBe('segment-bytes');

    const home = await request(t.app).get('/api/home?source=jasmr').expect(200);
    const pageRes = await request(t.app).get(`/api/pages/${home.body.pagedId}`).expect(200);
    const cover = pageRes.body.items[0].items[0].cover.request.url;
    expect(cover).toBe(LIST_COVER);
    const image = await request(t.app)
      .get(`/api/proxy?url=${encodeURIComponent(cover)}`)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          cb(null, Buffer.concat(chunks));
        });
      })
      .expect(200);
    expect(image.headers['content-type']).toBe('image/jpeg');
    expect((image.body as Buffer).toString()).toBe('jpeg');
  });

  it('refuses a URL that the server never issued', async () => {
    const res = await request(t.app)
      .get(`/api/proxy?url=${encodeURIComponent('https://v.weeab0o.xyz/other.ts')}`)
      .expect(403);
    expect(res.body).toEqual({ type: 'forbidden', message: 'URL was not issued by the extension' });
  });

  it('answers actions the site does not have with not_supported', async () => {
    const res = await request(t.app)
      .post('/api/like')
      .send({ item: album, shouldLike: true })
      .expect(501);
    expect(res.body.type).toBe('not_supported');
  });
});

describe('japaneseasmr bot check', () => {
  it('shows a clear error when the site is behind its bot check', async () => {
    const blockedSite = new MockAgent();
    blockedSite.disableNetConnect();
    blockedSite
      .get('https://japaneseasmr.com')
      .intercept({ path: '/', method: 'GET' })
      .reply(
        403,
        '<title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/x"></script>',
      );
    const blocked = await makeTestApp({
      extension: createFakeExtension(),
      jasmrDispatcher: blockedSite,
    });
    try {
      // The home feed loads its shelves when the page is requested, so the check happens there.
      const opened = await request(blocked.app).get('/api/home?source=jasmr').expect(200);
      const res = await request(blocked.app).get(`/api/pages/${opened.body.pagedId}`).expect(503);
      expect(res.body.type).toBe('upstream');
      expect(res.body.message).toMatch(/bot check/);
    } finally {
      await blocked.cleanup();
      await blockedSite.close();
    }
  });
});
