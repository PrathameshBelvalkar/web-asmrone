import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MockAgent } from 'undici';
import { describe, expect, it } from 'vitest';
import {
  isAllowedAddress,
  JavdatabaseClient,
} from '../../src/extension/javdatabase/api/javdatabase.client.js';
import {
  idolListAddress,
  movieListAddress,
} from '../../src/extension/javdatabase/javdatabase.extension.js';
import { parseIdolList, parseMovieList } from '../../src/extension/javdatabase/parsers/cards.js';
import {
  parseGenresPage,
  parseIdolPage,
  parseMoviePage,
} from '../../src/extension/javdatabase/parsers/details.js';
import {
  newsPathOf,
  parseNewsList,
  parseNewsPost,
} from '../../src/extension/javdatabase/parsers/news.js';
import { BLOCKED_JAV_TITLE } from '../../src/lib/content-rules.js';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '..', 'fixtures', 'javdatabase', name), 'utf8');
const SITE = 'https://www.javdatabase.com';

describe('javdatabase.com list parsers', () => {
  it('reads the movie list and drops the sponsored cards mixed into it', () => {
    const list = parseMovieList(fixture('movies-page-1.html'), 1);
    // 18 movies and 12 sponsored cards that link off-site.
    expect(list.items).toHaveLength(18);
    expect(list.items[0]).toEqual({
      slug: 'dori-1607',
      kind: 'censored',
      dvdId: 'DORI-1607',
      title: expect.stringMatching(/^\[Lucky Bag\]/),
      releaseDate: '2026-12-20',
      upcoming: false,
      cover: 'https://www.javdatabase.com/covers/thumb/h_/h_491dori01607ps.webp',
      studio: { slug: 'first-star', name: 'First Star' },
    });
    // Two cards with blocked titles have their covers blanked in the fixture.
    expect(
      list.items
        .filter((c) => c.cover !== null)
        .every((c) => c.cover?.startsWith(`${SITE}/covers/thumb/`)),
    ).toBe(true);
    expect(list.lastPage).toBe(26996);
    expect(list.hasMore).toBe(true);
    expect(list.heading).toBeNull();
  });

  it('reads uncensored cards, which have no DVD ID and covers on the studio host', () => {
    const list = parseMovieList(fixture('uncensored-page-1.html'), 1);
    expect(list.items).toHaveLength(20);
    expect(list.items[0]).toMatchObject({
      kind: 'uncensored',
      dvdId: null,
      title: 'Time Fuck Bandits : Sandwich Anal Fuck – Caribbeancom – 2026-11-16',
      releaseDate: '2026-11-16',
      cover: 'https://en.caribbeancom.com/moviepages/111626-001/images/thum_sh.jpg',
      studio: { slug: 'caribbeancom', name: 'Caribbeancom' },
    });
  });

  it('names a genre or studio list from its heading', () => {
    expect(parseMovieList(fixture('genre-creampie.html'), 1)).toMatchObject({
      heading: 'Creampie',
      lastPage: 8636,
    });
    expect(parseMovieList(fixture('studio-kawaii.html'), 1)).toMatchObject({
      heading: 'kawaii',
      lastPage: 154,
    });
    expect(parseMovieList(fixture('search-movies.html'), 1).items).toHaveLength(18);
  });

  it('reads idol lists, filtered and searched', () => {
    const idols = parseIdolList(fixture('idols-page-1.html'), 1);
    expect(idols.items).toHaveLength(18);
    expect(idols.items[0]).toEqual({
      slug: 'nagi-takanashi',
      name: 'Nagi Takanashi',
      photo: 'https://www.javdatabase.com/idolimages/thumb/nagi-takanashi.webp',
      age: 21,
    });
    expect(idols.lastPage).toBe(2253);
    expect(parseIdolList(fixture('idols-cup-g.html'), 1)).toMatchObject({
      lastPage: 59,
      items: expect.any(Array),
    });
    expect(parseIdolList(fixture('search-idols.html'), 1).items).toHaveLength(18);
  });
});

describe('javdatabase.com detail parsers', () => {
  it('reads a movie page: info, cast, samples, trailer and similar movies', () => {
    const m = parseMoviePage(fixture('movie-fns-206.html'), 'censored', 'fns-206');
    expect(m).toMatchObject({
      dvdId: 'FNS-206',
      contentId: '1fns00206',
      releaseDate: '2026-09-03',
      runtimeMin: 124,
      studio: { slug: 'faleno', name: 'Faleno' },
      director: null,
      series: null,
      coverFull: 'https://www.javdatabase.com/covers/full/1f/1fns00206pl.webp',
      trailer: expect.stringMatching(/^https:\/\/cc3001\.dmm\.co\.jp\/pv\/.+\/1fns00206mhb\.mp4$/),
    });
    expect(m.genres.map((g) => g.slug)).toEqual([
      'cosplay',
      'cowgirl',
      'doggystyle',
      'featured-actress',
      'hi-def',
      'married-woman',
    ]);
    expect(m.idols).toEqual([
      {
        slug: 'nene-yoshitaka',
        name: 'Nene Yoshitaka',
        photo: `${SITE}/idolimages/thumb/nene-yoshitaka.webp`,
        age: null,
      },
    ]);
    expect(m.samples).toHaveLength(10);
    expect(m.samples[0]).toEqual({
      thumb: 'https://pics.dmm.co.jp/digital/video/1fns00206/1fns00206-1.jpg',
      full: 'https://pics.dmm.co.jp/digital/video/1fns00206/1fns00206jp-1.jpg',
    });
    expect(m.similar).toHaveLength(6);
    expect(m.similar.every((c) => c.slug !== 'fns-206')).toBe(true);
  });

  it('reads an upcoming movie without a trailer', () => {
    const m = parseMoviePage(fixture('movie-savr-1268.html'), 'censored', 'savr-1268');
    expect(m.trailer).toBeNull();
    expect(m.releaseDate).toBe('2026-12-19');
    expect(m.samples).toHaveLength(17);
    expect(m.idols.map((i) => i.slug)).toEqual(['aoi-aosaka']);
  });

  it('reads an uncensored movie page, whose info is a table', () => {
    const m = parseMoviePage(fixture('movie-uncensored.html'), 'uncensored', 'x');
    expect(m).toMatchObject({
      dvdId: null,
      title: 'Time Fuck Bandits : Sandwich Anal Fuck – Caribbeancom – 2026-11-16',
      releaseDate: '2026-11-16',
      runtimeMin: 67,
      studio: { slug: 'caribbeancom' },
      coverFull: 'https://en.caribbeancom.com/moviepages/111626-001/images/poster_en.jpg',
      trailer: 'https://smovie.caribbeancom.com/sample/movies/111626-001/480p.mp4',
    });
    expect(m.genres).toHaveLength(11);
    expect(m.idols.map((i) => i.slug)).toEqual(['sanae-hosoda']);
    // Every "similar" card on this page is sponsored.
    expect(m.similar).toEqual([]);
  });

  it('reads an idol page: profile, movies with paging, and related idols', () => {
    const idol = parseIdolPage(fixture('idol-hikaru-nagi.html'), 'hikaru-nagi', 1);
    expect(idol).toMatchObject({
      name: 'Hikaru Nagi',
      nameJapanese: '凪ひかる',
      altNames: ['Asuka Aka', 'Shiose'],
      age: 29,
      dob: '1997-04-06',
      debut: '2020-10-03',
      debutAge: 23,
      birthplace: null,
      blood: 'A',
      measurements: '105-59-88',
      cup: 'J',
      heightCm: 162,
      shoeSize: null,
      hairLength: ['Long', 'Medium'],
      hairColor: ['Black', 'Brown'],
      tags: ['Twenties', 'Big Tits', 'Slim'],
      censoredCount: 246,
      uncensoredCount: 0,
      photoFull: `${SITE}/idolimages/full/hikaru-nagi.webp`,
      photo: `${SITE}/idolimages/thumb/hikaru-nagi.webp`,
    });
    expect(idol.bio).toMatch(/^Hikaru Nagi is a 29 year old JAV Idol\./);
    expect(idol.movies.items).toHaveLength(18);
    expect(idol.movies.lastPage).toBe(14);
    expect(idol.related.length).toBeGreaterThan(0);
    expect(idol.related.every((r) => r.slug !== 'hikaru-nagi')).toBe(true);
  });

  it('reads the genre groups', () => {
    const groups = parseGenresPage(fixture('genres.html'));
    expect(groups.map((g) => g.name)).toEqual([
      'Top Genres',
      'Theme',
      'Female Body Type',
      'Female Character/Costume',
      'Male Body Type',
      'Male Character',
      'Sex Acts',
      'Fetish',
      'Scenario',
      'Movie Features',
    ]);
    expect(groups[0]?.genres[0]).toEqual({ slug: 'amateur', name: 'Amateur' });
  });
});

describe('javdatabase.com news parsers', () => {
  it('reads the blog and a blog category', () => {
    const blog = parseNewsList(fixture('blog-page-1.html'), 1);
    expect(blog.items).toHaveLength(10);
    expect(blog.items[0]).toEqual({
      path: '2026/11/13/top-jav-movies-2026-week-45-5th-11th-november-2026',
      url: `${SITE}/2026/11/13/top-jav-movies-2026-week-45-5th-11th-november-2026/`,
      title: 'Top JAV Movies – 2026 – Week 45 (5th – 11th November 2026)',
      date: '2026-11-13',
      categories: [{ slug: 'top-jav-movies', name: 'Top JAV Movies' }],
      summary: expect.stringMatching(/^The kawaii studio’s 20th Anniversary.*…$/),
      image: `${SITE}/wp-content/uploads/2026/11/CAWB-056-450x236.jpg`,
    });
    expect(blog.lastPage).toBe(26);
    expect(parseNewsList(fixture('category-new-jav-debuts.html'), 1)).toMatchObject({
      lastPage: 6,
      hasMore: true,
    });
  });

  it('reads the ranked lists of the weekly posts', () => {
    const top = parseNewsPost(fixture('post-top-movies.html'), '2026/11/13/top');
    expect(top.title).toBe('Top JAV Movies – 2026 – Week 45 (5th – 11th November 2026)');
    expect(top.intro).toMatch(/^The kawaii studio’s 20th Anniversary Special movie, CAWB-056/);
    expect(top.ranked).toHaveLength(25);
    expect(top.ranked[0]).toMatchObject({
      rank: 1,
      type: 'movie',
      movie: {
        slug: 'cawb-056',
        dvdId: 'CAWB-056',
        studio: { slug: 'kawaii' },
        cover: expect.stringContaining('/covers/thumb/'),
      },
    });
    const debuts = parseNewsPost(fixture('post-new-debuts.html'), '2026/11/13/new');
    expect(debuts.ranked).toHaveLength(8);
    expect(debuts.ranked[0]).toEqual({
      rank: 1,
      type: 'idol',
      idol: {
        slug: 'nagi-takanashi',
        name: 'Nagi Takanashi',
        photo: `${SITE}/idolimages/thumb/nagi-takanashi.webp`,
        age: 21,
      },
    });
  });

  it('reads post addresses', () => {
    expect(newsPathOf(`${SITE}/2026/11/13/some-post/`)).toBe('2026/11/13/some-post');
    expect(newsPathOf(`${SITE}/blog/`)).toBeNull();
    expect(newsPathOf('https://evil.example/2026/11/13/x/')).toBeNull();
  });
});

describe('javdatabase.com addresses', () => {
  const ok = (path: string) => isAllowedAddress(new URL(path, SITE));

  it('requests only catalogue pages', () => {
    expect(ok('/movies/')).toBe(true);
    expect(ok('/movies/page/2/?_sort_=top_rated')).toBe(true);
    expect(ok('/uncensored/some-title-2026-11-16/')).toBe(true);
    expect(ok('/genres/')).toBe(true);
    expect(ok('/genres/creampie/page/3/')).toBe(true);
    expect(ok('/studios/kawaii/')).toBe(true);
    expect(ok('/idols/hikaru-nagi/?ipage=2')).toBe(true);
    expect(ok('/idols/page/2/?_cup_size=d%2Ce&_age_group=twenties&_sort_=most_favorited')).toBe(
      true,
    );
    expect(ok('/idols/?_debut_year=2024.00%2C2026.00')).toBe(true);
    expect(ok('/?s=aoi&post_type=idols')).toBe(true);
    expect(ok('/page/2/?s=aoi&post_type=movies%2Cuncensored')).toBe(true);
    expect(ok('/blog/?paged=3')).toBe(true);
    expect(ok('/category/new-jav-debuts/page/2/')).toBe(true);
    expect(ok('/2026/11/13/top-jav-movies-2026-week-45/')).toBe(true);
  });

  it('refuses everything else, including the loli idol filter', () => {
    expect(ok('/')).toBe(false);
    expect(ok('/wp-json/wp/v2/posts')).toBe(false);
    expect(ok('/wp-admin/admin-ajax.php')).toBe(false);
    expect(ok('/login/')).toBe(false);
    expect(ok('/favorites/')).toBe(false);
    expect(ok('/idols/?_body_type=loli')).toBe(false);
    expect(ok('/idols/?_body_type=slim%2Cloli')).toBe(false);
    expect(ok('/movies/?_cup_size=d')).toBe(false);
    expect(ok('/movies/?_sort_=random')).toBe(false);
    expect(ok('/genres/../login/')).toBe(false);
    expect(isAllowedAddress(new URL('https://evil.example/movies/'))).toBe(false);
  });

  it('builds list addresses', () => {
    expect(movieListAddress({ by: 'all', kind: 'censored', sort: 'release', page: 1 })).toBe(
      '/movies/',
    );
    expect(movieListAddress({ by: 'all', kind: 'uncensored', sort: 'top_rated', page: 3 })).toBe(
      '/uncensored/page/3/?_sort_=top_rated',
    );
    expect(movieListAddress({ by: 'genre', slug: 'creampie', page: 2 })).toBe(
      '/genres/creampie/page/2/',
    );
    expect(movieListAddress({ by: 'search', q: 'aoi', page: 2 })).toBe(
      '/page/2/?s=aoi&post_type=movies%2Cuncensored',
    );
    expect(
      idolListAddress({
        sort: 'most_favorited',
        facets: { cup_size: ['d', 'e'] },
        debutYear: [2024, 2026],
        page: 2,
      }),
    ).toBe('/idols/page/2/?_cup_size=d%2Ce&_debut_year=2024.00%2C2026.00&_sort_=most_favorited');
    expect(idolListAddress({ sort: 'debut', facets: {}, debutYear: null, page: 1 })).toBe(
      '/idols/',
    );
    for (const address of [
      movieListAddress({ by: 'search', q: 'aoi', page: 2 }),
      idolListAddress({
        sort: 'name',
        facets: { body_type: ['slim'], hair_color: ['black'] },
        debutYear: null,
        page: 1,
      }),
    ]) {
      expect(ok(address)).toBe(true);
    }
  });
});

describe('javdatabase.com client', () => {
  const options = { gapMs: 0, listingTtlMs: 60_000, detailTtlMs: 60_000, staticTtlMs: 60_000 };

  it('backs off after a bot check and never retries through it', async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    const site = agent.get(SITE);
    site
      .intercept({ path: '/movies/', method: 'GET' })
      .reply(403, '<title>Just a moment...</title>');
    let now = 0;
    const client = new JavdatabaseClient(agent, { ...options, now: () => now });
    await expect(client.page('/movies/')).rejects.toMatchObject({ status: 503 });
    // Paused: no request is made (an unmatched request would throw a different error).
    await expect(client.page('/movies/')).rejects.toMatchObject({
      status: 503,
      publicMessage: expect.stringMatching(/limiting/),
    });
    now += 16 * 60_000;
    site.intercept({ path: '/movies/', method: 'GET' }).reply(200, '<html></html>');
    await expect(client.page('/movies/')).resolves.toBe('<html></html>');
    // Cached: answered without another request.
    await expect(client.page('/movies/')).resolves.toBe('<html></html>');
  });

  it("doesn't treat Cloudflare's background script on a normal page as a block", async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    const page = fixture('movie-savr-1268.html').replace(
      '</body>',
      '<script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script></body>',
    );
    agent.get(SITE).intercept({ path: '/movies/savr-1268/', method: 'GET' }).reply(200, page);
    const client = new JavdatabaseClient(agent, options);
    await expect(client.page('/movies/savr-1268/')).resolves.toContain('challenge-platform');
  });

  it('backs off on a challenge answered with status 200', async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    agent
      .get(SITE)
      .intercept({ path: '/genres/', method: 'GET' })
      .reply(200, '<html></html>', { headers: { 'cf-mitigated': 'challenge' } });
    const client = new JavdatabaseClient(agent, options);
    await expect(client.page('/genres/')).rejects.toMatchObject({ status: 503 });
  });

  it('refuses addresses outside the allow-list before any request', () => {
    const client = new JavdatabaseClient(new MockAgent(), options);
    expect(() => client.page('/wp-json/')).toThrow(/not part of the catalogue/);
  });
});

describe('JAV title rules', () => {
  it('blocks school roles and children, and leaves adult titles alone', () => {
    expect(BLOCKED_JAV_TITLE.test('Schoolgirl After Class')).toBe(true);
    expect(BLOCKED_JAV_TITLE.test('Wearing a School Uniform')).toBe(true);
    expect(BLOCKED_JAV_TITLE.test('Sailor Uniform Special')).toBe(true);
    expect(BLOCKED_JAV_TITLE.test('A JK Story')).toBe(true);
    expect(BLOCKED_JAV_TITLE.test('女子校生の放課後')).toBe(true);
    expect(BLOCKED_JAV_TITLE.test('Office Lady Overtime')).toBe(false);
    expect(BLOCKED_JAV_TITLE.test('Female Teacher at the Hot Spring')).toBe(false);
  });
});
