import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HanimeClient, isCatalogAddress } from '../../src/extension/hanime/hanime.client.js';
import {
  altTitles,
  censorshipOf,
  isBlockedTitle,
  paragraphs,
  seriesOf,
  toRecord,
} from '../../src/extension/hanime/mappers.js';
import { parseBrowseTags, parseTitlePage } from '../../src/extension/hanime/parsers.js';
import { rawTitleSchema, type RawTitle } from '../../src/extension/hanime/schema.js';
import { HanimeCatalog } from '../../src/services/hanime/catalog.js';
import { baselineOf, diff } from '../../src/services/hanime/sync.service.js';
import { IssuedUrls } from '../../src/stores/issued-urls.js';

const raw: unknown[] = (
  JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', 'hanime', 'catalog.json'), 'utf8')) as {
    data: unknown[];
  }
).data;
const titles: RawTitle[] = raw.map((r) => rawTitleSchema.parse(r));
const bySlug = (slug: string): RawTitle => {
  const t = titles.find((x) => x.slug === slug);
  if (t === undefined) throw new Error(slug);
  return t;
};
const records = titles.filter((t) => !isBlockedTitle(t)).map(toRecord);

describe('hanime mappers', () => {
  it('reads every fixture title', () => {
    expect(titles).toHaveLength(raw.length);
  });

  it('pulls the other-language titles out of search_titles', () => {
    const t = bySlug('yabai-fukushuu-yami-site-2');
    expect(altTitles(t.search_titles, t.name)).toEqual([
      'ヤバい! -復讐・闇サイト-',
      '위험해! -복수・암흑',
      '危机！-复仇·暗黑网站',
    ]);
    const s = bySlug('25-sai-no-joshikousei-season-1');
    expect(altTitles(s.search_titles, s.name)).toEqual([
      '25세의 여고생',
      '25歳の女子高生',
      '25岁的女高中生',
    ]);
  });

  it('turns the description into paragraphs', () => {
    expect(paragraphs('<p>One <b>two</b></p><p>Three</p>')).toEqual(['One two', 'Three']);
    expect(paragraphs('Line one<br><br>Line two')).toEqual(['Line one', 'Line two']);
    expect(paragraphs('')).toEqual([]);
  });

  it('finds the series and episode from the name', () => {
    expect(seriesOf('Ane Koi 2')).toEqual({ key: 'ane koi', name: 'Ane Koi', episode: 2 });
    expect(seriesOf('Eroriman 2 Episode 1')).toMatchObject({ key: 'eroriman 2', episode: 1 });
    expect(seriesOf('Overflow')).toEqual({ key: 'overflow', name: 'Overflow', episode: null });
  });

  it('reads censorship from the tags', () => {
    expect(censorshipOf(['hd', 'uncensored'])).toBe('uncensored');
    expect(censorshipOf(['censored'])).toBe('censored');
    expect(censorshipOf(['hd'])).toBeNull();
  });

  it('blocks only the listed series and blocked tags, not words in other titles', () => {
    expect(isBlockedTitle(bySlug('test-blocked-series-1'))).toBe(true);
    expect(isBlockedTitle(bySlug('test-blocked-tag-1'))).toBe(true);
    // エロリーマン holds ロリ, and these have "school girl": all stay.
    expect(isBlockedTitle(bySlug('eroriman-1'))).toBe(false);
    expect(isBlockedTitle(bySlug('25-sai-no-joshikousei-season-1'))).toBe(false);
    expect(records).toHaveLength(titles.length - 2);
  });

  it('keeps only hanime-cdn images and slugs the studio', () => {
    const r = toRecord({
      ...bySlug('ane-koi-1'),
      poster_url: 'https://evil.example/x.jpg',
      brand: 'Pink Pineapple',
    });
    expect(r.poster).toBe('');
    expect(r.cover).toMatch(/^https:\/\/hanime-cdn\.com\/images\//);
    expect(r.studio).toEqual({ slug: 'pink-pineapple', name: 'Pink Pineapple' });
  });
});

describe('HanimeCatalog', () => {
  const catalog = new HanimeCatalog(records, new Set(['test-blocked-series-1']));

  it('searches names, other languages and tags, best first', () => {
    expect(catalog.search('ane koi').map((h) => h.entry.slug)).toEqual(['ane-koi-1', 'ane-koi-2']);
    expect(catalog.search('fuku')[0]?.entry.slug).toMatch(/^yabai-fukushuu/);
    expect(catalog.search('復讐').map((h) => h.entry.slug)).toContain('yabai-fukushuu-yami-site-2');
    expect(catalog.search('위험해')).toHaveLength(2);
    expect(catalog.search('yuri').length).toBeGreaterThan(0);
    expect(catalog.search('zzzz-nothing')).toEqual([]);
  });

  it('ranks the exact name above everything else', () => {
    expect(catalog.search('Ane Koi 2')[0]?.entry.slug).toBe('ane-koi-2');
  });

  it('groups series by episode and counts tags and studios', () => {
    expect(catalog.seriesOf('ane koi').map((e) => e.episode)).toEqual([1, 2]);
    expect(catalog.tag('blow-job')?.count).toBeGreaterThan(0);
    expect(catalog.studioList().every((s) => (s.count ?? 0) > 0)).toBe(true);
    expect(catalog.isBlocked('test-blocked-series-1')).toBe(true);
  });

  it('finds similar titles outside the series', () => {
    const entry = catalog.get('ane-koi-1');
    if (entry === undefined) throw new Error('missing');
    const similar = catalog.similar(entry, 5);
    expect(similar.length).toBeGreaterThan(0);
    expect(similar.every((e) => e.seriesKey !== 'ane koi')).toBe(true);
  });

  it('marks new uploads and episode numbers on cards', () => {
    const entry = catalog.get('ane-koi-2');
    if (entry === undefined) throw new Error('missing');
    const card = catalog.card(entry, entry.uploadedMs + 60_000);
    expect(card).toMatchObject({ isNew: true, episode: 2 });
    expect(catalog.card(entry, entry.uploadedMs + 30 * 86_400_000).isNew).toBe(false);
  });
});

describe('hanime sync helpers', () => {
  it('diffs by id and ignores view counts', () => {
    const before = new HanimeCatalog(records.slice(0, 5));
    const [first, second, , , fifth] = records;
    if (first === undefined || second === undefined || fifth === undefined)
      throw new Error('fixture');
    const next = [
      { ...first, views: first.views + 1000 },
      { ...second, name: 'Renamed' },
      records[2],
      records[3],
      records[6],
    ].filter((r) => r !== undefined);
    const changes = diff(before, next, '2026-11-17T00:00:00Z');
    expect(changes.map((c) => [c.kind, c.slug])).toEqual([
      ['updated', second.slug],
      ['added', records[6]?.slug],
      ['removed', fifth.slug],
    ]);
    expect(changes[0]?.fields).toEqual(['name']);
  });

  it('takes the views from about a week ago as the trending baseline', () => {
    const now = Date.parse('2026-11-17T12:00:00Z');
    expect(baselineOf({ days: {} }, now)).toBeNull();
    expect(baselineOf({ days: { '2026-11-17': { 1: 5 } } }, now)).toBeNull();
    const b = baselineOf(
      { days: { '2026-11-05': { 1: 1 }, '2026-11-10': { 1: 10 }, '2026-11-16': { 1: 20 } } },
      now,
    );
    expect(b?.views.get(1)).toBe(10);
  });
});

describe('HanimeClient', () => {
  let agent: MockAgent;
  beforeEach(() => {
    agent = new MockAgent();
    agent.disableNetConnect();
  });
  afterEach(async () => {
    await agent.close();
  });

  it('accepts only the catalog address, without a query string', () => {
    expect(isCatalogAddress('https://guest.freeanimehentai.net/api/v11/search_hvs')).toBe(true);
    expect(isCatalogAddress('https://guest.freeanimehentai.net/api/v12/search_hvs')).toBe(true);
    expect(isCatalogAddress('https://guest.freeanimehentai.net/api/v11/search_hvs?page=1')).toBe(
      false,
    );
    expect(isCatalogAddress('https://evil.example/api/v11/search_hvs')).toBe(false);
    expect(isCatalogAddress('http://guest.freeanimehentai.net/api/v11/search_hvs')).toBe(false);
  });

  it('unzips a gzipped answer', async () => {
    agent
      .get('https://guest.freeanimehentai.net')
      .intercept({ path: '/api/v11/search_hvs', method: 'GET' })
      .reply(200, gzipSync('{"data":[]}'), { headers: { 'content-encoding': 'gzip' } });
    expect(await new HanimeClient(agent).catalog()).toBe('{"data":[]}');
  });

  it('backs off on a Cloudflare block and stops asking', async () => {
    agent
      .get('https://guest.freeanimehentai.net')
      .intercept({ path: '/api/v11/search_hvs', method: 'GET' })
      .reply(403, '<title>Attention Required! | Cloudflare</title>');
    const client = new HanimeClient(agent);
    await expect(client.catalog()).rejects.toMatchObject({ status: 503 });
    expect(client.isPaused()).toBe(true);
    // No second interceptor: a request would throw a different error.
    await expect(client.catalog()).rejects.toMatchObject({ status: 503 });
  });

  it('reads the slugs from the gzipped sitemap and the moved catalog address from the home page', async () => {
    const site = agent.get('https://hanime.tv');
    site
      .intercept({ path: '/sitemap.xml.gz', method: 'GET' })
      .reply(
        200,
        gzipSync(
          '<urlset><url><loc>https://hanime.tv/videos/hentai/ane-koi-1</loc></url></urlset>',
        ),
      );
    site
      .intercept({ path: '/', method: 'GET' })
      .reply(
        200,
        '<script>window.AppConfig={"search_hvs_url":"https://guest.freeanimehentai.net/api/v12/search_hvs"}</script>',
      );
    const client = new HanimeClient(agent);
    expect(await client.sitemapSlugs()).toEqual(['ane-koi-1']);
    expect(await client.discoverCatalogUrl()).toBe(
      'https://guest.freeanimehentai.net/api/v12/search_hvs',
    );
  });
});

describe('IssuedUrls prefixes', () => {
  it('allows a folder but not tricks around it', () => {
    const issued = new IssuedUrls(10);
    issued.allowPrefix('https://hanime-cdn.com/images/');
    expect(issued.headersOf('https://hanime-cdn.com/images/posters/a.jpg')).toEqual({});
    expect(issued.headersOf('https://hanime-cdn.com/images/../secret')).toBeUndefined();
    expect(issued.headersOf('https://hanime-cdn.com/images/a.jpg?x=1')).toBeUndefined();
    expect(issued.headersOf('https://hanime-cdn.com/other/a.jpg')).toBeUndefined();
    expect(issued.headersOf('https://hanime-cdn.com/images/%2e%2e%2fx')).toBeUndefined();
    expect(() => {
      issued.allowPrefix('http://x/');
    }).toThrow();
  });
});

describe('hanime page parsers', () => {
  const page = (name: string) =>
    readFileSync(join(__dirname, '..', 'fixtures', 'hanime', name), 'utf8');

  it('reads the Preview storyboard, length, badges, other names and synopsis from a title page', () => {
    const d = parseTitlePage(page('title-ane-koi-1.html'));
    expect(d.storyboard).toEqual({
      url: 'https://hanime-cdn.com/images/storyboards/ane-koi-1-720p-v2u.jpg',
      columns: 5,
      rows: 36,
      tiles: 180,
    });
    expect(d.durationSec).toBe(25 * 60 + 45);
    expect(d.badges).toEqual(['FHD 1080p', '26 min', 'Sub EN', 'Dub JP']);
    expect(d.altNames).toContain('姉恋 スキ・キライ・ダイスキ.');
    expect(d.altNames).toHaveLength(7);
    expect(d.synopsis[0]).toMatch(/^Based on a manga/);
  });

  it('leaves out what a page lacks, and storyboards on other hosts', () => {
    const d = parseTitlePage(
      `<astro-island props='{"storyboard_url":[0,"https://evil.example/s.jpg"],"storyboard_columns":[0,5],"storyboard_rows":[0,36],"storyboard_tile_count":[0,180]}'></astro-island>`,
    );
    expect(d).toEqual({
      durationSec: null,
      badges: [],
      altNames: [],
      synopsis: [],
      storyboard: null,
    });
  });

  it('reads each tag card on Browse: description and picture', () => {
    const tags = parseBrowseTags(page('browse.html'));
    expect(tags.get('anal')).toEqual({
      description: 'B-b-but I poop from there!',
      image: 'https://hanime-cdn.com/images/tags/anal-vertical.min.jpg',
    });
    expect(tags.get('2000-year-old dragon girl')?.image).toMatch(/2kdragon/);
  });
});
