import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import request from 'supertest';
import { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from '../helpers/app.js';

const fixtureText = readFileSync(
  join(__dirname, '..', 'fixtures', 'hanime', 'catalog.json'),
  'utf8',
);
const SITE = 'https://hentaibros.net';
const FILE = 'https://cdn.vintageporno.stream/Ane%20Koi%2001%20Sub.mp4';
const page = (src: string, h1 = 'Ane Koi episode 1') =>
  `<html><h1>${h1}</h1><div data-item="${JSON.stringify({ sources: [{ src }] }).replace(/"/g, '&quot;')}"></div></html>`;

describe('/api/hanime/title/:slug/stream', () => {
  let hanime: MockAgent;
  let bros: MockAgent;
  let t: TestApp;
  const pageHits: string[] = [];

  beforeEach(async () => {
    hanime = new MockAgent();
    hanime.disableNetConnect();
    const h = hanime.get('https://hanime.tv');
    h.intercept({ path: '/sitemap.xml.gz', method: 'GET' })
      .reply(200, gzipSync('<urlset></urlset>'))
      .persist();
    h.intercept({ path: '/browse', method: 'GET' }).reply(200, '<html></html>').persist();
    hanime
      .get('https://guest.freeanimehentai.net')
      .intercept({ path: '/api/v11/search_hvs', method: 'GET' })
      .reply(200, fixtureText);

    bros = new MockAgent();
    bros.disableNetConnect();
    const b = bros.get(SITE);
    b.intercept({ path: '/sitemap_index.xml', method: 'GET' })
      .reply(
        200,
        `<sitemapindex><sitemap><loc>${SITE}/post-sitemap.xml</loc></sitemap></sitemapindex>`,
      )
      .persist();
    b.intercept({ path: '/post-sitemap.xml', method: 'GET' })
      .reply(
        200,
        `<urlset><url><loc>${SITE}/ane-koi-episode-1/</loc></url><url><loc>${SITE}/kotowari-episode-1/</loc></url></urlset>`,
      )
      .persist();
    b.intercept({ path: '/ane-koi-episode-1/', method: 'GET' })
      .reply(() => {
        pageHits.push('ane-koi-episode-1');
        return { statusCode: 200, data: page(FILE) };
      })
      .persist();
    b.intercept({ path: '/kotowari-episode-1/', method: 'GET' })
      .reply(() => {
        pageHits.push('kotowari-episode-1');
        return { statusCode: 503, data: '<title>Just a moment...</title>' };
      })
      .persist();
    pageHits.length = 0;

    t = await makeTestApp({ hanimeDispatcher: hanime, hentaibrosDispatcher: bros });
    await request(t.app).post('/api/hanime/sync').expect(200);
  });

  afterEach(async () => {
    await t.cleanup();
    await hanime.close();
    await bros.close();
  });

  it('finds the title’s episode page and answers with its video, once', async () => {
    const res = await request(t.app).get('/api/hanime/title/ane-koi-1/stream').expect(200);
    expect(res.body).toEqual({
      file: FILE,
      page: `${SITE}/ane-koi-episode-1/`,
      title: 'Ane Koi episode 1',
    });
    await request(t.app).get('/api/hanime/title/ane-koi-1/stream').expect(200);
    expect(pageHits).toHaveLength(1);
  });

  it('answers 404 for a title the site doesn’t have, and applies the content rules', async () => {
    const miss = await request(t.app).get('/api/hanime/title/ane-koi-2/stream').expect(404);
    expect(miss.body.message).toMatch(/no video/);
    await request(t.app).get('/api/hanime/title/test-blocked-series-1/stream').expect(451);
    await request(t.app).get('/api/hanime/title/no-such-title/stream').expect(404);
    expect(pageHits).toHaveLength(0);
  });

  it('stops asking hentaibros.net for a while after a bot check', async () => {
    await request(t.app).get('/api/hanime/title/kotowari-1/stream').expect(503);
    // The pause covers every request to the site, not only that page.
    await request(t.app).get('/api/hanime/title/ane-koi-1/stream').expect(503);
    expect(pageHits).toEqual(['kotowari-episode-1']);
  });
});
