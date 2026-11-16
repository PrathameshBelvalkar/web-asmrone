import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from '../helpers/app.js';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '..', 'fixtures', 'javguru', name), 'utf8');
const JAVDATABASE = 'https://www.javdatabase.com';
const JAVGURU = 'https://jav.guru';
const EMBED = 'https://javclan.com';
const POST_PATH =
  '/1077157/dldss-575-my-salary-went-up-again-this-year-ignoring-my-husband-happily-talking-about-it-im-being-creampied-by-his-boss-sumi-naho/';
/** 2026-11-16 at noon in Japan. */
const NOW = Date.parse('2026-11-16T03:00:00Z');

function moviePage(slug: string, title: string, releaseDate: string): string {
  return `<html><body><main><h1>${slug.toUpperCase()} - ${title}</h1>
    <div id="poster-container"><img src="${JAVDATABASE}/covers/full/xx/${slug}pl.webp"></div>
    <p class="mb-1"><b>Title: </b>${title}</p>
    <p class="mb-1"><b>DVD ID: </b>${slug.toUpperCase()}</p>
    <p class="mb-1"><b>Release Date: </b>${releaseDate}</p>
  </main></body></html>`;
}

describe('/api/jav/movie/:kind/:slug/stream', () => {
  let agent: MockAgent;
  let t: TestApp;

  beforeEach(async () => {
    agent = new MockAgent();
    agent.disableNetConnect();
    t = await makeTestApp({
      javdatabaseDispatcher: agent,
      javguruDispatcher: agent,
      proxyDispatcher: agent,
      javClock: { now: () => NOW },
    });
  });

  afterEach(async () => {
    await t.cleanup();
    await agent.close();
  });

  const movie = (slug: string, title = 'A movie', date = '2026-10-01') =>
    agent
      .get(JAVDATABASE)
      .intercept({ path: `/movies/${slug}/`, method: 'GET' })
      .reply(200, moviePage(slug, title, date));
  const search = (body: string) =>
    agent
      .get(JAVGURU)
      .intercept({ path: (p) => p.startsWith('/wp-json/wp/v2/posts?'), method: 'GET' })
      .reply(200, body);

  it('resolves STREAM SB to the embed master playlist, then serves it from cache', async () => {
    movie('dldss-575');
    search(fixture('rest-search-dldss-575.json'));
    agent
      .get(JAVGURU)
      .intercept({ path: POST_PATH, method: 'GET' })
      .reply(200, fixture('post-dldss-575.html'));
    agent
      .get(EMBED)
      .intercept({
        path: '/e/jt0slmiufqlw',
        method: 'GET',
        headers: { referer: 'https://jav.guru/' },
      })
      .reply(200, fixture('embed-jt0slmiufqlw.html'));

    const res = await request(t.app).get('/api/jav/movie/censored/dldss-575/stream').expect(200);
    expect(res.body).toEqual({
      server: 'sb',
      master: expect.stringMatching(/^https:\/\/javclan\.com\/stream\/.+\/master\.m3u8$/),
      expiresAt: NOW + 60 * 60_000,
    });
    expect(res.headers['cache-control']).toBe('no-store');

    // Cached: no interceptor is left, so a second request upstream would fail.
    const again = await request(t.app).get('/api/jav/movie/censored/dldss-575/stream').expect(200);
    expect(again.body.master).toBe(res.body.master);

    // The proxy serves the master; the variant playlist goes through the proxy, segments don't.
    const master = new URL(res.body.master as string);
    const dir = master.pathname.replace(/master\.m3u8$/, '');
    agent
      .get(EMBED)
      .intercept({ path: master.pathname, method: 'GET' })
      .reply(200, '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=495212\nindex-f1-v1-a1.m3u8\n', {
        headers: { 'content-type': 'application/vnd.apple.mpegurl' },
      });
    agent
      .get(EMBED)
      .intercept({ path: `${dir}index-f1-v1-a1.m3u8`, method: 'GET' })
      .reply(
        200,
        '#EXTM3U\n#EXTINF:10.010,\nhttps://p16-ad-site-sign-sg.tiktokcdn.com/seg~1.image?x=1\n',
        {
          headers: { 'content-type': 'application/vnd.apple.mpegurl' },
        },
      );
    const top = await request(t.app).get('/api/proxy').query({ url: master.href }).expect(200);
    const child = `${EMBED}${dir}index-f1-v1-a1.m3u8`;
    expect(top.text).toContain(`/api/proxy?url=${encodeURIComponent(child)}`);
    const variant = await request(t.app).get('/api/proxy').query({ url: child }).expect(200);
    expect(variant.text).toContain('\nhttps://p16-ad-site-sign-sg.tiktokcdn.com/seg~1.image?x=1\n');
  }, 15_000);

  it('asks the gateway only when the known embed host no longer has the file', async () => {
    movie('dldss-575');
    search(fixture('rest-search-dldss-575.json'));
    agent
      .get(JAVGURU)
      .intercept({ path: POST_PATH, method: 'GET' })
      .reply(200, fixture('post-dldss-575.html'));
    agent.get(EMBED).intercept({ path: '/e/jt0slmiufqlw', method: 'GET' }).reply(404, 'gone');
    agent
      .get(JAVGURU)
      .intercept({ path: '/searcho/?xr=6a7430736c6d697566716c77', method: 'GET' })
      .reply(302, '', { headers: { location: 'https://newhost.example/e/jt0slmiufqlw' } });
    agent
      .get('https://newhost.example')
      .intercept({ path: '/e/jt0slmiufqlw', method: 'GET' })
      .reply(200, fixture('embed-jt0slmiufqlw.html'));

    const res = await request(t.app).get('/api/jav/movie/censored/dldss-575/stream').expect(200);
    // hls4 is relative, so it follows the embed to its new host.
    expect(res.body.master).toMatch(/^https:\/\/newhost\.example\/stream\//);
  }, 15_000);

  it('answers 404 when jav.guru has no post for the DVD ID', async () => {
    movie('abc-123');
    search('[]');
    const res = await request(t.app).get('/api/jav/movie/censored/abc-123/stream').expect(404);
    expect(res.body.message).toBe('No stream was found for this movie.');
  });

  it('never looks for a stream for an upcoming movie', async () => {
    movie('abc-124', 'Soon', '2027-01-01');
    await request(t.app).get('/api/jav/movie/censored/abc-124/stream').expect(404);
  });

  it('applies the content rules before going to jav.guru', async () => {
    movie('abc-125', 'A schoolgirl story');
    await request(t.app).get('/api/jav/movie/censored/abc-125/stream').expect(451);
  });

  it('answers 503 and stops asking after a rate limit', async () => {
    movie('abc-126');
    agent
      .get(JAVGURU)
      .intercept({ path: (p) => p.startsWith('/wp-json/'), method: 'GET' })
      .reply(429, 'slow down', { headers: { 'cf-mitigated': 'challenge' } });
    await request(t.app).get('/api/jav/movie/censored/abc-126/stream').expect(503);
    // Paused: this would need a second jav.guru interceptor if a request were made.
    await request(t.app).get('/api/jav/movie/censored/abc-126/stream').expect(503);
  });

  it('accepts only the sb server', async () => {
    await request(t.app).get('/api/jav/movie/censored/abc-127/stream?server=vo').expect(400);
  });
});
