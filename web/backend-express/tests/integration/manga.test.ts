import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from '../helpers/app.js';

const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', 'threehentai', name), 'utf8');
const SITE = 'https://3hentai.to';

/** A reader page whose gallery has the given tags (only the parts the parser reads). */
function readerPage(id: number, tags: { id: number; type: string; name: string; url: string }[]): string {
  const gallery = {
    id,
    media_id: '123',
    title: { english: `Gallery ${id}`, japanese: null, pretty: null },
    images: { pages: [{ t: 'j', w: 800, h: 1200 }], cover: { t: 'j', w: 350, h: 500 }, thumbnail: null },
    scanlator: '',
    upload_date: 1700000000,
    tags,
    num_pages: 1,
  };
  return `<html><script>var reader = new N.reader({ media_url: 'x', gallery: ${JSON.stringify(gallery)}, start_page: 1 });</script></html>`;
}

/** A listing page with one card per entry of `cards` ([id, tag ids, title?]). */
function listingPage(cards: [number, number[], string?][]): string {
  const items = cards
    .map(
      ([id, tags, title]) =>
        `<div class="doujin" data-tags="${tags.join(' ')}"><a href="/d/${id}/" class="cover"><img data-src="https://3-hentai.xyz/${id}/thumb.jpg"><div class="title flag flag-eng">${title ?? `Card ${id}`}</div></a></div>`,
    )
    .join('');
  return `<html><div class="listing-container">${items}</div></html>`;
}

describe('/api/manga', () => {
  let agent: MockAgent;
  let t: TestApp;

  beforeEach(async () => {
    agent = new MockAgent();
    agent.disableNetConnect();
    t = await makeTestApp({ threehentaiDispatcher: agent, proxyDispatcher: agent });
  });

  afterEach(async () => {
    await t.cleanup();
    await agent.close();
  });

  const site = () => agent.get(SITE);

  it('is open without any setting', async () => {
    site().intercept({ path: '/kai', method: 'GET' }).reply(200, listingPage([[1, [9]]]));
    await request(t.app).get('/api/manga/browse').expect(200);
    await request(t.app).get('/api/manga/status').expect(404);
  });

  it('drops cards with a blocked tag from Browse and hides tag ids from the client', async () => {
    site().intercept({ path: '/kai', method: 'GET' }).reply(200, fixture('tag-yuri.html'));
    const res = await request(t.app).get('/api/manga/browse').expect(200);
    expect(res.body.items.length).toBe(20);
    expect(res.body.items.some((c: { title: string }) => c.title === 'blocked')).toBe(false);
    expect(res.body.items[0]).not.toHaveProperty('tagIds');
    expect(res.body.hasMore).toBe(true);
  });

  it('serves a gallery, and lets the proxy fetch its pages', async () => {
    site().intercept({ path: '/d/699591/1/', method: 'GET' }).reply(200, fixture('reader-699591-1.html'));
    const res = await request(t.app).get('/api/manga/gallery/699591').expect(200);
    expect(res.body.pages).toHaveLength(53);
    expect(res.body.tags[0]).not.toHaveProperty('id');
    const page = res.body.pages[0].url as string;
    expect(page).toBe('https://3-hentai.xyz/4327126/1.webp');
    agent.get('https://3-hentai.xyz').intercept({ path: '/4327126/1.webp', method: 'GET' }).reply(200, 'img', {
      headers: { 'content-type': 'image/webp' },
    });
    const img = await request(t.app).get('/api/proxy').query({ url: page }).expect(200);
    expect(img.headers['content-type']).toBe('image/webp');
    // Addresses that were never handed out stay refused.
    await request(t.app).get('/api/proxy').query({ url: 'https://3-hentai.xyz/1/1.jpg' }).expect(403);
  });

  it('refuses a gallery with a blocked tag (451), then drops its tag from listings too', async () => {
    site()
      .intercept({ path: '/d/5/1/', method: 'GET' })
      .reply(200, readerPage(5, [{ id: 777777, type: 'tag', name: 'lolicon', url: '/tag/lolicon/' }]));
    const res = await request(t.app).get('/api/manga/gallery/5').expect(451);
    expect(res.body.type).toBe('forbidden');
    site()
      .intercept({ path: '/d/6/1/', method: 'GET' })
      .reply(200, readerPage(6, [{ id: 888, type: 'tag', name: 'lolibaba', url: '/tag/lolibaba/' }]));
    await request(t.app).get('/api/manga/gallery/6').expect(451);

    site()
      .intercept({ path: '/tag/yuri/', method: 'GET' })
      .reply(200, listingPage([[1, [9]], [2, [777777, 9]], [3, [30]]]));
    const list = await request(t.app).get('/api/manga/tag/yuri').expect(200);
    expect(list.body.items.map((c: { id: string }) => c.id)).toEqual(['1']);
  });

  it('drops cards and refuses galleries whose titles say the characters are children', async () => {
    site()
      .intercept({ path: '/kai', method: 'GET' })
      .reply(
        200,
        listingPage([
          [1, [9], 'My Childhood Friend'],
          [2, [9], '武装少女 元気満満的中学秘密少女社团'],
          [3, [9], '[Artist] Elementary School Trip'],
          [4, [9], 'A JC Story'],
          [5, [9], 'Office Lady Overtime'],
        ]),
      );
    const list = await request(t.app).get('/api/manga/browse').expect(200);
    expect(list.body.items.map((c: { id: string }) => c.id)).toEqual(['1', '5']);

    const page = readerPage(7, [{ id: 9, type: 'tag', name: 'sole female', url: '/tag/sole-female/' }]).replace(
      'Gallery 7',
      'Middle School Club',
    );
    site().intercept({ path: '/d/7/1/', method: 'GET' }).reply(200, page);
    await request(t.app).get('/api/manga/gallery/7').expect(451);
  });

  it('returns nothing for searches and tag pages that name a blocked tag, without asking the site', async () => {
    const search = await request(t.app).get('/api/manga/search').query({ q: 'tag:lolicon' }).expect(200);
    expect(search.body).toEqual({ tag: null, items: [], page: 1, lastPage: 1, hasMore: false });
    await request(t.app).get('/api/manga/search').query({ q: 'Shota' }).expect(200);
    await request(t.app).get('/api/manga/tag/low-lolicon').expect(451);
    await request(t.app).get('/api/manga/tag/oppai-loli').expect(451);
    await request(t.app).get('/api/manga/tag/lolibaba').expect(451);
    await request(t.app).get('/api/manga/artist/loli-fan').expect(451);
  });

  it('leaves blocked tags out of the A–Z index', async () => {
    site()
      .intercept({ path: '/tags/?letter=l', method: 'GET' })
      .reply(
        200,
        '<a class="name" href="/tag/lingerie/" data-qty="5K">lingerie</a><a class="name" href="/tag/lolicon/" data-qty="9K">lolicon</a><a class="name" href="/tag/low-shotacon/" data-qty="1K">low shotacon</a><a class="name" href="/tag/lolibaba/" data-qty="2K">lolibaba</a><a class="name" href="/tag/shotaro-ishinomori/" data-qty="3">shotaro ishinomori</a>',
      );
    const res = await request(t.app).get('/api/manga/index/tag').query({ letter: 'l' }).expect(200);
    expect(res.body.items.map((t: { slug: string }) => t.slug)).toEqual(['lingerie', 'shotaro-ishinomori']);
    expect(res.body.items[0]).toEqual({ kind: 'tag', slug: 'lingerie', name: 'lingerie', count: 5000 });
  });

  it('searches a name list by reading every page of the first letter', async () => {
    const names = (list: [string, string][]) =>
      list.map(([slug, qty]) => `<a class="name" href="/artist/${slug}/" data-qty="${qty}">${slug.replace(/-/g, ' ')}</a>`).join('');
    site()
      .intercept({ path: '/artists/?letter=s', method: 'GET' })
      .reply(200, `${names([['sasaki', '12'], ['shotaro-ishinomori', '3'], ['big-sasaki-fan', '1']])}<ul class="pagination"><a href="/artists/?letter=s&page=2">2</a></ul>`);
    site()
      .intercept({ path: '/artists/?letter=s&page=2', method: 'GET' })
      .reply(200, `${names([['studio-sasa', '40'], ['shota-lover', '9']])}<ul class="pagination"><a href="/artists/?letter=s&page=1">1</a></ul>`);
    const res = await request(t.app).get('/api/manga/index/artist/search').query({ q: 'Sasa' }).expect(200);
    // Names starting with the query first, then by gallery count; blocked names are left out.
    expect(res.body.items.map((t: { slug: string }) => t.slug)).toEqual(['sasaki', 'studio-sasa', 'big-sasaki-fan']);
    expect(res.body.items[0]).toEqual({ kind: 'artist', slug: 'sasaki', name: 'sasaki', count: 12 });

    const blocked = await request(t.app).get('/api/manga/index/tag/search').query({ q: 'loli' }).expect(200);
    expect(blocked.body.items).toEqual([]);
    await request(t.app).get('/api/manga/index/tag/search').expect(400);
    await request(t.app).get('/api/manga/index/language/search').query({ q: 'en' }).expect(404);
  });

  it('names the artist of an artist list, and refuses a list whose heading is a blocked tag', async () => {
    site()
      .intercept({ path: '/artist/orita/', method: 'GET' })
      .reply(200, `<h1><a class="name" href="/artist/orita/" data-qty="65">orita</a></h1>${listingPage([[1, [9]]])}`);
    const res = await request(t.app).get('/api/manga/artist/orita').expect(200);
    expect(res.body.tag).toEqual({ kind: 'artist', slug: 'orita', name: 'orita', count: 65 });
    expect(res.body.items).toHaveLength(1);

    site()
      .intercept({ path: '/tag/school-days/', method: 'GET' })
      .reply(200, `<h1><a class="name" href="/tag/school-days/" data-qty="5">lolicon</a></h1>${listingPage([[1, [9]]])}`);
    await request(t.app).get('/api/manga/tag/school-days').expect(451);
  });

  it('checks its input', async () => {
    await request(t.app).get('/api/manga/search').expect(400);
    await request(t.app).get('/api/manga/browse').query({ page: '0' }).expect(400);
    await request(t.app).get('/api/manga/gallery/abc').expect(404);
    await request(t.app).get('/api/manga/nope/x').expect(404);
    await request(t.app).get('/api/manga/index/language').expect(404);
    await request(t.app).get('/api/manga/tag/a%2Fb').expect(400);
  });
});
