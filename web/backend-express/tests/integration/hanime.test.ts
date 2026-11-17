import { readFileSync } from 'node:fs';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
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
type Raw = {
  id: number;
  slug: string;
  name: string;
  views: number;
  created_at_unix: number;
  tags: string[];
};
const fixture = (): { data: Raw[] } => JSON.parse(fixtureText) as { data: Raw[] };
const page = (name: string) =>
  readFileSync(join(__dirname, '..', 'fixtures', 'hanime', name), 'utf8');

const CATALOG_HOST = 'https://guest.freeanimehentai.net';
const CATALOG_PATH = '/api/v11/search_hvs';
const NOW = Date.parse('2026-11-17T12:00:00Z');
const SITEMAP = gzipSync(
  '<urlset><url><loc>https://hanime.tv/videos/hentai/ane-koi-1</loc></url></urlset>',
);

describe('/api/hanime', () => {
  let agent: MockAgent;
  let t: TestApp;
  let now = NOW;

  beforeEach(async () => {
    now = NOW;
    agent = new MockAgent();
    agent.disableNetConnect();
    agent
      .get('https://hanime.tv')
      .intercept({ path: '/sitemap.xml.gz', method: 'GET' })
      .reply(200, SITEMAP)
      .persist();
    agent
      .get('https://hanime.tv')
      .intercept({ path: '/browse', method: 'GET' })
      .reply(200, page('browse.html'))
      .persist();
    t = await makeTestApp({
      hanimeDispatcher: agent,
      proxyDispatcher: agent,
      hanimeClock: { now: () => now },
    });
  });

  afterEach(async () => {
    await t.cleanup();
    await agent.close();
  });

  const serve = (body: string | object, status = 200): void => {
    agent
      .get(CATALOG_HOST)
      .intercept({ path: CATALOG_PATH, method: 'GET' })
      .reply(status, typeof body === 'string' ? body : JSON.stringify(body));
  };
  /** A manual sync, moving the clock past the gap between manual syncs. */
  const sync = async () => {
    now += 6 * 60_000;
    return request(t.app).post('/api/hanime/sync').expect(200);
  };

  it('answers 503 before the catalog is downloaded', async () => {
    await request(t.app).get('/api/hanime/titles').expect(503);
  });

  it('downloads the catalog, drops ads and blocked titles, and lists the newest upload first', async () => {
    serve(fixtureText);
    const status = await sync();
    const total = fixture().data.length - 2;
    expect(status.body).toMatchObject({ titles: total, error: null, paused: false });

    const res = await request(t.app).get('/api/hanime/titles').expect(200);
    expect(res.body).toMatchObject({ page: 1, total, lastPage: 2, hasMore: true });
    expect(res.body.items).toHaveLength(24);
    const newest = [...fixture().data].sort((a, b) => b.created_at_unix - a.created_at_unix)[0];
    expect(res.body.items[0].slug).toBe(newest?.slug);
    expect(JSON.stringify(res.body)).not.toContain('ads.example');

    for (const file of ['catalog.json', 'views.json', 'state.json']) {
      await expect(readFile(join(t.dataDir, 'hanime', file), 'utf8')).resolves.toBeTruthy();
    }
  });

  it('filters by tags, excluded tags, studio, censorship and years, and sorts', async () => {
    serve(fixtureText);
    await sync();
    const all = fixture().data.filter((r) => !r.slug.startsWith('test-'));

    const yuri = await request(t.app).get('/api/hanime/titles?tags=yuri&size=60').expect(200);
    expect(yuri.body.total).toBe(all.filter((r) => r.tags.includes('yuri')).length);

    const either = await request(t.app)
      .get('/api/hanime/titles?tags=yuri,yaoi&tagMode=or&size=60')
      .expect(200);
    expect(either.body.total).toBe(
      all.filter((r) => r.tags.includes('yuri') || r.tags.includes('yaoi')).length,
    );

    const without = await request(t.app).get('/api/hanime/titles?exclude=yuri&size=60').expect(200);
    expect(without.body.total).toBe(all.length - yuri.body.total);

    const unc = await request(t.app)
      .get('/api/hanime/titles?censored=uncensored&size=60')
      .expect(200);
    expect(unc.body.items.every((c: { censorship: string }) => c.censorship === 'uncensored')).toBe(
      true,
    );

    const views = await request(t.app).get('/api/hanime/titles?sort=views&size=3').expect(200);
    const top = [...all]
      .sort((a, b) => b.views - a.views)
      .slice(0, 3)
      .map((r) => r.slug);
    expect(views.body.items.map((c: { slug: string }) => c.slug)).toEqual(top);

    const old = await request(t.app).get('/api/hanime/titles?year=1990,2005&size=60').expect(200);
    for (const c of old.body.items as { releasedAt: string }[]) {
      expect(Number(c.releasedAt.slice(0, 4))).toBeLessThanOrEqual(2005);
    }

    const studio = (yuri.body.items[0] as { studio: { slug: string } }).studio.slug;
    const byStudio = await request(t.app)
      .get(`/api/hanime/titles?studios=${studio}&size=60`)
      .expect(200);
    expect(
      byStudio.body.items.every((c: { studio: { slug: string } }) => c.studio.slug === studio),
    ).toBe(true);

    const series = await request(t.app)
      .get('/api/hanime/titles?series=ane%20koi&sort=name')
      .expect(200);
    expect(series.body.items.map((c: { slug: string }) => c.slug)).toEqual([
      'ane-koi-1',
      'ane-koi-2',
    ]);

    await request(t.app).get('/api/hanime/titles?tags=not-a-tag').expect(400);
    await request(t.app).get('/api/hanime/titles?tags=loli').expect(451);
    await request(t.app).get('/api/hanime/titles?sort=random').expect(400);
    await request(t.app).get('/api/hanime/titles?size=500').expect(400);
  });

  it('searches with relevance and suggests titles, series, tags and studios', async () => {
    serve(fixtureText);
    await sync();
    const res = await request(t.app).get('/api/hanime/titles?q=ane%20koi').expect(200);
    expect(res.body.items.map((c: { slug: string }) => c.slug)).toEqual(['ane-koi-1', 'ane-koi-2']);

    const s = await request(t.app).get('/api/hanime/suggest?q=ane').expect(200);
    const types = (s.body as { type: string }[]).map((x) => x.type);
    expect(types).toContain('title');
    expect(types).toContain('series');

    const tag = await request(t.app).get('/api/hanime/suggest?q=tentac').expect(200);
    expect(tag.body).toContainEqual({
      type: 'tag',
      ref: { slug: 'tentacle', name: 'tentacle', count: expect.any(Number) },
    });

    expect((await request(t.app).get('/api/hanime/suggest?q=loli').expect(200)).body).toEqual([]);
    expect((await request(t.app).get('/api/hanime/titles?q=loli').expect(200)).body.total).toBe(0);
  });

  it('shows a title with its episodes and similar titles, and 451 / 404 for others', async () => {
    serve(fixtureText);
    await sync();
    const res = await request(t.app).get('/api/hanime/title/ane-koi-1').expect(200);
    expect(res.body).toMatchObject({
      slug: 'ane-koi-1',
      episode: 1,
      series: { key: 'ane koi', name: 'Ane Koi' },
      siteUrl: 'https://hanime.tv/videos/hentai/ane-koi-1',
    });
    expect(res.body.episodes.map((c: { slug: string }) => c.slug)).toEqual([
      'ane-koi-1',
      'ane-koi-2',
    ]);
    expect(res.body.similar.length).toBeGreaterThan(0);
    expect(res.body.altTitles.length).toBeGreaterThan(0);
    expect(res.body.description.length).toBeGreaterThan(0);

    await request(t.app).get('/api/hanime/title/test-blocked-series-1').expect(451);
    await request(t.app).get('/api/hanime/title/no-such-title').expect(404);
  });

  it('lists tags in groups, studios, and Home shelves', async () => {
    serve(fixtureText);
    await sync();
    const tags = await request(t.app).get('/api/hanime/tags').expect(200);
    expect(tags.body.map((g: { group: string }) => g.group)).toContain('Acts');
    const school = (tags.body as { tags: { slug: string }[] }[])
      .flatMap((g) => g.tags)
      .map((x) => x.slug);
    expect(school).toContain('school-girl');

    const studios = await request(t.app).get('/api/hanime/studios?sort=name').expect(200);
    const names = (studios.body as { name: string }[]).map((s) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

    const home = await request(t.app).get('/api/hanime/home').expect(200);
    expect(home.body.slice(0, 4).map((s: { key: string }) => s.key)).toEqual([
      'new',
      'trending',
      'views',
      'rating',
    ]);
    expect(home.body[0].items.length).toBeGreaterThan(0);
  });

  it('records added, updated and removed titles, but not view counts', async () => {
    serve(fixtureText);
    await sync();
    const next = fixture();
    const [first, second] = next.data;
    if (first === undefined || second === undefined) throw new Error('fixture');
    first.views += 5000;
    second.name = 'Renamed Title';
    const removed = next.data.splice(5, 1)[0];
    next.data.push({ ...first, id: 777, slug: 'brand-new-1', name: 'Brand New 1' });
    serve(next);
    await sync();

    const changes = await request(t.app).get('/api/hanime/changes').expect(200);
    expect(
      (changes.body as { kind: string; slug: string }[]).map((c) => [c.kind, c.slug]).sort(),
    ).toEqual(
      [
        ['added', 'brand-new-1'],
        ['removed', removed?.slug],
        ['updated', second.slug],
      ].sort(),
    );
    await request(t.app)
      .get(`/api/hanime/title/${removed?.slug ?? ''}`)
      .expect(404);
  });

  it('skips an unchanged catalog and rejects one that lost half its titles', async () => {
    serve(fixtureText);
    await sync();
    serve(fixtureText);
    await sync();
    expect((await request(t.app).get('/api/hanime/changes').expect(200)).body).toEqual([]);

    const half = fixture();
    half.data = half.data.slice(0, 10);
    serve(half);
    const status = await sync();
    expect(status.body.error).toMatch(/only 10 titles/);
    expect((await request(t.app).get('/api/hanime/titles').expect(200)).body.total).toBe(
      fixture().data.length - 2,
    );
  });

  it('keeps its copy and pauses on a Cloudflare block', async () => {
    serve(fixtureText);
    await sync();
    serve('<title>Just a moment...</title>', 503);
    const status = await sync();
    expect(status.body).toMatchObject({ paused: true });
    expect(status.body.error).toMatch(/limiting/);
    await request(t.app).get('/api/hanime/titles').expect(200);
  });

  it('refuses a second manual sync within five minutes', async () => {
    serve(fixtureText);
    await sync();
    await request(t.app).post('/api/hanime/sync').expect(429);
  });

  it('loads the saved copy at start-up', async () => {
    serve(fixtureText);
    await sync();
    const again = await makeTestApp({ hanimeDispatcher: agent, hanimeClock: { now: () => now } });
    try {
      // The saved copy is read on the first request, so the files can be put in place first.
      await mkdir(join(again.dataDir, 'hanime'), { recursive: true });
      for (const f of ['catalog.json', 'views.json', 'state.json']) {
        await copyFile(join(t.dataDir, 'hanime', f), join(again.dataDir, 'hanime', f));
      }
      const res = await request(again.app).get('/api/hanime/title/ane-koi-2').expect(200);
      expect(res.body.slug).toBe('ane-koi-2');
    } finally {
      await again.cleanup();
    }
  });

  it('serves posters through the proxy fallback without registering them', async () => {
    agent
      .get('https://hanime-cdn.com')
      .intercept({ path: '/images/posters/x.jpg', method: 'GET' })
      .reply(200, 'img', {
        headers: { 'content-type': 'image/jpeg' },
      });
    const res = await request(t.app)
      .get(`/api/proxy?url=${encodeURIComponent('https://hanime-cdn.com/images/posters/x.jpg')}`)
      .expect(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    await request(t.app)
      .get(`/api/proxy?url=${encodeURIComponent('https://hanime-cdn.com/api/x')}`)
      .expect(403);
  });

  it('pushes a catalog event to listeners when a sync changes something', async () => {
    serve(fixtureText);
    await sync();
    const server = t.app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    const controller = new AbortController();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/hanime/events`, {
        signal: controller.signal,
      });
      expect(res.headers.get('content-type')).toBe('text/event-stream');
      const reader = res.body?.getReader();
      if (reader === undefined) throw new Error('no body');
      await reader.read(); // retry: line

      const next = fixture();
      next.data.push({ ...(next.data[0] as Raw), id: 778, slug: 'pushed-1', name: 'Pushed 1' });
      serve(next);
      await sync();

      let text = '';
      while (!text.includes('event: catalog')) {
        const chunk = await reader.read();
        if (chunk.done) break;
        text += new TextDecoder().decode(chunk.value);
      }
      expect(text).toContain('"added":1');
    } finally {
      controller.abort();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('reads a title page once for its Preview, length and other names, then serves it from cache', async () => {
    serve(fixtureText);
    await sync();
    agent
      .get('https://hanime.tv')
      .intercept({ path: '/videos/hentai/ane-koi-1', method: 'GET' })
      .reply(200, page('title-ane-koi-1.html'));
    const first = await request(t.app).get('/api/hanime/title/ane-koi-1/details').expect(200);
    expect(first.body).toMatchObject({
      durationSec: 1545,
      badges: ['FHD 1080p', '26 min', 'Sub EN', 'Dub JP'],
      storyboard: { columns: 5, rows: 36, tiles: 180 },
    });
    expect(first.body.altNames).toHaveLength(7);
    // No second interceptor: a second page read would fail.
    await request(t.app).get('/api/hanime/title/ane-koi-1/details').expect(200);
    await request(t.app).get('/api/hanime/title/test-blocked-series-1/details').expect(451);
    await request(t.app).get('/api/hanime/title/no-such-title/details').expect(404);
  });

  it('reads the tag pictures even when the catalog is unchanged since the saved copy', async () => {
    const saved = await makeTestApp({ hanimeDispatcher: agent, hanimeClock: { now: () => now } });
    try {
      // A saved copy from before tag pictures existed: same catalog, no tags.json.
      serve(fixtureText);
      await sync();
      await mkdir(join(saved.dataDir, 'hanime'), { recursive: true });
      for (const f of ['catalog.json', 'views.json']) {
        await copyFile(join(t.dataDir, 'hanime', f), join(saved.dataDir, 'hanime', f));
      }
      serve(fixtureText);
      await request(saved.app).post('/api/hanime/sync').expect(200);
      const tags = await request(saved.app).get('/api/hanime/tags').expect(200);
      expect(JSON.stringify(tags.body)).toContain('B-b-but I poop from there!');
    } finally {
      await saved.cleanup();
    }
  });

  it('gives tags their Browse descriptions and pictures', async () => {
    serve(fixtureText);
    await sync();
    const tags = await request(t.app).get('/api/hanime/tags').expect(200);
    const anal = (tags.body as { tags: { slug: string; description: string; image: string }[] }[])
      .flatMap((g) => g.tags)
      .find((x) => x.slug === 'anal');
    expect(anal).toMatchObject({
      description: 'B-b-but I poop from there!',
      image: 'https://hanime-cdn.com/images/tags/anal-vertical.min.jpg',
    });
    await expect(readFile(join(t.dataDir, 'hanime', 'tags.json'), 'utf8')).resolves.toContain(
      'poop',
    );
  });

  it('lists a year by season, and picks a random title', async () => {
    serve(fixtureText);
    await sync();
    const res = await request(t.app).get('/api/hanime/seasons').expect(200);
    expect(res.body.year).toBe(res.body.years[0]);
    for (const s of res.body.seasons as { season: string; items: { releasedAt: string }[] }[]) {
      const months = {
        Winter: [1, 2, 3],
        Spring: [4, 5, 6],
        Summer: [7, 8, 9],
        Fall: [10, 11, 12],
      }[s.season];
      for (const c of s.items) expect(months).toContain(Number(c.releasedAt.slice(5, 7)));
    }
    const older = await request(t.app).get('/api/hanime/seasons?year=2014').expect(200);
    expect(older.body.year).toBe(2014);
    await request(t.app).get('/api/hanime/seasons?year=abc').expect(400);
    const random = await request(t.app).get('/api/hanime/random').expect(200);
    expect(random.body.slug).toEqual(expect.any(String));
  });
});
