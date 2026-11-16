import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from '../helpers/app.js';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '..', 'fixtures', 'javdatabase', name), 'utf8');
const SITE = 'https://www.javdatabase.com';
/** 2026-11-16 at noon in Japan. */
const NOW = Date.parse('2026-11-16T03:00:00Z');

type Card = [slug: string, date: string, title?: string];

/** A movie list page with one card per entry, a sponsored card, and paging up to `last`. */
function moviesPage(cards: Card[], page = 1, last = 1): string {
  const items = cards
    .map(
      ([
        slug,
        date,
        title,
      ]) => `<div class="col-4"><div class="card h-100 borderlesscard"><div class="card-body">
        <p class="display-6 pcard"><a href="${SITE}/movies/${slug}/" class="cut-text">${slug.toUpperCase()}</a></p>
        <div class="movie-cover-thumb"><a href="${SITE}/movies/${slug}/"><img src="${SITE}/covers/thumb/xx/${slug}ps.webp"></a></div>
        <div class="mt-auto"><a href="${SITE}/movies/${slug}/" class="cut-text">${title ?? `Movie ${slug}`}</a> ${date}</div>
        <span class="btn"><a href="${SITE}/studios/s1/" rel="tag">Studio One</a></span></div></div></div>`,
    )
    .join('');
  const ad = `<div class="card"><p class="display-6 pcard"><a href="https://ads.example/x" rel="sponsored">Ad</a></p><div class="movie-cover-thumb"><img src="https://ads.example/x.jpg"></div></div>`;
  const paging =
    page < last
      ? `<ul class="pagination"><li><a href="${SITE}/movies/page/${page + 1}/">${page + 1}</a></li><li><a href="${SITE}/movies/page/${last}/">»</a></li></ul>`
      : '';
  return `<html><body><main>${paging}<div class="row">${ad}${items}</div></main></body></html>`;
}

/** A movie page with the given genres and title. */
function moviePage(slug: string, title: string, genres: string[], trailer = ''): string {
  const genreLinks = genres
    .map((g) => `<span><a href="${SITE}/genres/${g}/" rel="tag">${g}</a></span>`)
    .join(' ');
  return `<html><body><main><h1>${slug.toUpperCase()} - ${title}</h1>
    <div id="poster-container"><img src="${SITE}/covers/full/xx/${slug}pl.webp"></div>
    <video id="jav-player"><source src="${trailer}" type="video/mp4"/></video>
    <p class="mb-1"><b>Title: </b>${title}</p>
    <p class="mb-1"><b>DVD ID: </b>${slug.toUpperCase()}</p>
    <p class="mb-1"><b>Release Date: </b>2026-10-01</p>
    <p class="mb-1"><b>Genre(s): </b>${genreLinks}</p>
    <div class="image-gallery-section"><a data-image-src="https://pics.dmm.co.jp/digital/video/${slug}/${slug}jp-1.jpg"><img src="https://pics.dmm.co.jp/digital/video/${slug}/${slug}-1.jpg"></a></div>
  </main></body></html>`;
}

describe('/api/jav', () => {
  let agent: MockAgent;
  let t: TestApp;

  beforeEach(async () => {
    agent = new MockAgent();
    agent.disableNetConnect();
    t = await makeTestApp({
      javdatabaseDispatcher: agent,
      proxyDispatcher: agent,
      javClock: { now: () => NOW },
    });
  });

  afterEach(async () => {
    await t.cleanup();
    await agent.close();
  });

  const site = () => agent.get(SITE);

  it('lists movies without the sponsored cards, and marks upcoming ones', async () => {
    site().intercept({ path: '/movies/', method: 'GET' }).reply(200, fixture('movies-page-1.html'));
    const res = await request(t.app).get('/api/jav/movies').expect(200);
    // 18 movies on the page; two have blocked titles (blanked in the fixture).
    expect(res.body.items).toHaveLength(16);
    expect(res.body.items[0]).toMatchObject({
      slug: 'dori-1607',
      releaseDate: '2026-12-20',
      upcoming: true,
    });
    expect(res.body).toMatchObject({ heading: null, page: 1, lastPage: 26996, hasMore: true });

    site()
      .intercept({ path: '/uncensored/page/2/?_sort_=top_rated', method: 'GET' })
      .reply(200, fixture('uncensored-page-1.html'));
    const unc = await request(t.app)
      .get('/api/jav/movies')
      .query({ kind: 'uncensored', sort: 'top_rated', page: 2 })
      .expect(200);
    expect(unc.body.items[0]).toMatchObject({ kind: 'uncensored', dvdId: null, upcoming: false });
  });

  it('finds where released movies start, and pages Latest forwards and Upcoming backwards from there', async () => {
    // Pages 1–8 hold only announced movies, page 9 both, page 10 on only released ones.
    const paths: string[] = [];
    const cardsOf = (n: number): Card[] => {
      if (n < 9)
        return [
          [`f${n}a`, `2027-01-${String(30 - n).padStart(2, '0')}`],
          [`f${n}b`, `2027-01-${String(29 - n).padStart(2, '0')}`],
        ];
      if (n === 9)
        return [
          ['f9a', '2026-11-20'],
          ['f9b', '2026-11-17'],
          ['r9a', '2026-11-16'],
          ['r9b', '2026-11-10'],
        ];
      return [
        [`r${n}a`, '2026-10-01'],
        [`r${n}b`, '2026-09-30'],
      ];
    };
    site()
      .intercept({ path: (p) => p.startsWith('/movies/'), method: 'GET' })
      .reply((opts) => {
        paths.push(opts.path);
        const n = Number(/page\/(\d+)\//.exec(opts.path)?.[1] ?? '1');
        return { statusCode: 200, data: moviesPage(cardsOf(n), n, 100) };
      })
      .persist();

    const latest = await request(t.app).get('/api/jav/latest').expect(200);
    expect(latest.body.items.map((c: { slug: string }) => c.slug)).toEqual(['r9a', 'r9b']);
    expect(latest.body).toMatchObject({ page: 1, lastPage: 92, hasMore: true });
    // Doubling 1, 2, 4, 8, 16, then halving the gap: 12, 10, 9.
    expect(paths).toEqual([
      '/movies/',
      ...[2, 4, 8, 16, 12, 10, 9].map((n) => `/movies/page/${n}/`),
    ]);

    const latest2 = await request(t.app).get('/api/jav/latest').query({ page: 2 }).expect(200);
    expect(latest2.body.items.map((c: { slug: string }) => c.slug)).toEqual(['r10a', 'r10b']);

    const upcoming = await request(t.app).get('/api/jav/upcoming').expect(200);
    expect(upcoming.body.items.map((c: { slug: string }) => c.slug)).toEqual(['f9b', 'f9a']);
    expect(upcoming.body.items.every((c: { upcoming: boolean }) => c.upcoming)).toBe(true);
    expect(upcoming.body).toMatchObject({ page: 1, lastPage: 9, hasMore: true });
    const upcoming2 = await request(t.app).get('/api/jav/upcoming').query({ page: 2 }).expect(200);
    expect(upcoming2.body.items.map((c: { slug: string }) => c.slug)).toEqual(['f8b', 'f8a']);
    const end = await request(t.app).get('/api/jav/upcoming').query({ page: 10 }).expect(200);
    expect(end.body).toMatchObject({ items: [], hasMore: false });
    // The start page is remembered: no new scan.
    expect(paths.filter((p) => p === '/movies/page/16/')).toHaveLength(1);
  });

  it('serves a movie, lets the proxy fetch its images, and never proxies the trailer', async () => {
    const trailer = 'https://cc3001.dmm.co.jp/pv/abc/savr01268mhb.mp4';
    site()
      .intercept({ path: '/movies/abc-1/', method: 'GET' })
      .reply(200, moviePage('abc-1', 'Office Lady Overtime', ['drama'], trailer));
    const res = await request(t.app).get('/api/jav/movie/censored/abc-1').expect(200);
    expect(res.body).toMatchObject({
      dvdId: 'ABC-1',
      trailer,
      upcoming: false,
      genres: [{ slug: 'drama', name: 'drama' }],
    });
    const sample = res.body.samples[0].full as string;
    agent
      .get('https://pics.dmm.co.jp')
      .intercept({ path: '/digital/video/abc-1/abc-1jp-1.jpg', method: 'GET' })
      .reply(200, 'img', {
        headers: { 'content-type': 'image/jpeg' },
      });
    const img = await request(t.app).get('/api/proxy').query({ url: sample }).expect(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
    await request(t.app).get('/api/proxy').query({ url: trailer }).expect(403);
  });

  it('serves a real movie page', async () => {
    site()
      .intercept({ path: '/movies/savr-1268/', method: 'GET' })
      .reply(200, fixture('movie-savr-1268.html'));
    const res = await request(t.app).get('/api/jav/movie/censored/savr-1268').expect(200);
    expect(res.body).toMatchObject({
      dvdId: 'SAVR-1268',
      upcoming: true,
      trailer: null,
      runtimeMin: 82,
    });
    expect(res.body.samples).toHaveLength(17);
    expect(res.body.idols[0]).toMatchObject({ slug: 'aoi-aosaka' });
  });

  it('refuses a movie with a blocked genre or title (451), then drops it from lists too', async () => {
    site()
      .intercept({ path: '/movies/abc-2/', method: 'GET' })
      .reply(200, moviePage('abc-2', 'After Class', ['drama', 'schoolgirl']));
    const res = await request(t.app).get('/api/jav/movie/censored/abc-2').expect(451);
    expect(res.body.type).toBe('forbidden');
    // A real page whose title names a school uniform.
    site()
      .intercept({ path: '/movies/fns-206/', method: 'GET' })
      .reply(200, fixture('movie-fns-206.html'));
    await request(t.app).get('/api/jav/movie/censored/fns-206').expect(451);

    site()
      .intercept({ path: '/genres/drama/', method: 'GET' })
      .reply(
        200,
        moviesPage([
          ['abc-1', '2026-10-01'],
          ['abc-2', '2026-10-01'],
          ['abc-3', '2026-10-01', 'Sailor Uniform Club'],
          ['abc-4', '2026-10-01', 'Middle School Reunion'],
          ['abc-5', '2026-10-01', 'Hot Spring Trip'],
        ]),
      );
    const list = await request(t.app).get('/api/jav/movies/genre/drama').expect(200);
    expect(list.body.items.map((c: { slug: string }) => c.slug)).toEqual(['abc-1', 'abc-5']);
  });

  it('returns nothing for blocked genres and searches, without asking the site', async () => {
    await request(t.app).get('/api/jav/movies/genre/schoolgirl').expect(451);
    await request(t.app).get('/api/jav/movies/genre/sailor-uniform').expect(451);
    await request(t.app).get('/api/jav/movies/genre/shotacon').expect(451);
    for (const q of ['schoolgirl', 'School Uniform', 'loli', 'school']) {
      const res = await request(t.app).get('/api/jav/search').query({ q }).expect(200);
      expect(res.body.items).toEqual([]);
    }
    const idols = await request(t.app)
      .get('/api/jav/search')
      .query({ q: 'loli', type: 'idols' })
      .expect(200);
    expect(idols.body.items).toEqual([]);
    await request(t.app).get('/api/jav/idols').query({ body: 'loli' }).expect(400);
    await request(t.app).get('/api/jav/idols').query({ body: 'slim,loli' }).expect(400);
  });

  it('leaves blocked genres out of the genre groups', async () => {
    site().intercept({ path: '/genres/', method: 'GET' }).reply(200, fixture('genres.html'));
    const res = await request(t.app).get('/api/jav/genres').expect(200);
    const slugs = res.body.groups.flatMap((g: { genres: { slug: string }[] }) =>
      g.genres.map((x) => x.slug),
    );
    expect(slugs).toContain('creampie');
    for (const blocked of [
      'schoolgirl',
      'school',
      'school-uniform',
      'school-swimsuits',
      'sailor-uniform',
      'shotacon',
    ]) {
      expect(slugs).not.toContain(blocked);
    }
  });

  it('filters and sorts idols, and opens an idol page by page', async () => {
    site()
      .intercept({
        path: '/idols/page/2/?_cup_size=g&_age_group=twenties&_sort_=most_favorited',
        method: 'GET',
      })
      .reply(200, fixture('idols-cup-g.html'));
    const list = await request(t.app)
      .get('/api/jav/idols')
      .query({ cup: 'G', age: 'twenties', sort: 'most_favorited', page: 2 })
      .expect(200);
    expect(list.body.items[0]).toMatchObject({ slug: 'eimi-fukada', name: 'Eimi Fukada' });

    site()
      .intercept({ path: '/idols/hikaru-nagi/?ipage=2', method: 'GET' })
      .reply(200, fixture('idol-hikaru-nagi.html'));
    const idol = await request(t.app)
      .get('/api/jav/idol/hikaru-nagi')
      .query({ page: 2 })
      .expect(200);
    expect(idol.body).toMatchObject({ name: 'Hikaru Nagi', cup: 'J', censoredCount: 246 });
    expect(idol.body.movies.items.length).toBeGreaterThan(0);
  });

  it('serves the news and a weekly post', async () => {
    site()
      .intercept({ path: '/blog/?paged=2', method: 'GET' })
      .reply(200, fixture('blog-page-1.html'));
    const news = await request(t.app).get('/api/jav/news').query({ page: 2 }).expect(200);
    expect(news.body.items).toHaveLength(10);
    site()
      .intercept({ path: '/category/new-jav-debuts/', method: 'GET' })
      .reply(200, fixture('category-new-jav-debuts.html'));
    await request(t.app).get('/api/jav/news').query({ category: 'new-jav-debuts' }).expect(200);

    const path = '/2026/11/13/new-jav-idol-debuts-2026-week-45-5th-11th-november-2026/';
    site().intercept({ path, method: 'GET' }).reply(200, fixture('post-new-debuts.html'));
    const post = await request(t.app)
      .get(`/api/jav/news${path.slice(0, -1)}`)
      .expect(200);
    expect(post.body.ranked).toHaveLength(8);
    expect(post.body.ranked[0]).toMatchObject({
      rank: 1,
      type: 'idol',
      idol: { slug: 'nagi-takanashi' },
    });
  });

  it('checks its input', async () => {
    await request(t.app).get('/api/jav/search').expect(400);
    await request(t.app).get('/api/jav/search').query({ q: 'x', type: 'studios' }).expect(400);
    await request(t.app).get('/api/jav/movies').query({ page: '0' }).expect(400);
    await request(t.app).get('/api/jav/movies').query({ sort: 'random' }).expect(400);
    await request(t.app).get('/api/jav/latest').query({ kind: 'vr' }).expect(400);
    await request(t.app).get('/api/jav/news').query({ category: 'nope' }).expect(400);
    await request(t.app).get('/api/jav/idols').query({ debutYear: 'soon' }).expect(400);
    await request(t.app).get('/api/jav/movie/vr/abc-1').expect(404);
    await request(t.app).get('/api/jav/movies/series/x').expect(404);
    await request(t.app).get('/api/jav/movies/genre/a%2Fb').expect(400);
    await request(t.app).get('/api/jav/news/2026/1/13/x').expect(404);
  });
});
