import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MockAgent } from 'undici';
import { describe, expect, it } from 'vitest';
import { isAllowedAddress, ThreehentaiClient } from '../../src/extension/threehentai/api/threehentai.client.js';
import { parseGalleryPage, parseReaderPage } from '../../src/extension/threehentai/parsers/gallery.js';
import { parseIndexPage } from '../../src/extension/threehentai/parsers/index-page.js';
import { parseListing } from '../../src/extension/threehentai/parsers/listing.js';
import { parseQty, tagLinkOf } from '../../src/extension/threehentai/parsers/common.js';
import { listAddress } from '../../src/extension/threehentai/threehentai.extension.js';

const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', 'threehentai', name), 'utf8');
const SITE = 'https://3hentai.to';

describe('3hentai.to parsers', () => {
  it('reads the newest list on Browse, not the popular strip above it', () => {
    const list = parseListing(fixture('browse-page-1.html'), 1);
    // 5 popular cards, then 24 newest.
    expect(list.items).toHaveLength(24);
    expect(list.items[0]?.id).toBe('699592');
    expect(list.items[0]?.language).toBe('jpn');
    expect(list.items[0]?.cover).toMatch(/^https:\/\/3-hentai\.xyz\/\d+\/thumb\.(webp|jpg)$/);
    expect(list.items[0]?.aspect).toBeCloseTo(1.392);
    expect(list.items[0]?.tagIds).toEqual([9, 2, 17, 10197, 48626, 242, 544, 1642, 76017]);
    expect(list.items.every((c) => c.coverFallbacks.every((u) => u.startsWith('https://3-hentai.xyz/')))).toBe(true);
    expect(list.lastPage).toBe(26912);
    expect(list.hasMore).toBe(true);
  });

  it('reads tag and search lists, including the cards a content rule will drop', () => {
    const tag = parseListing(fixture('tag-yuri.html'), 1);
    expect(tag.items).toHaveLength(25);
    expect(tag.tag).toEqual({ kind: 'tag', slug: 'yuri', name: 'yuri', count: 36_000, id: null });
    expect(parseListing(fixture('browse-page-1.html'), 1).tag).toBeNull();
    expect(tag.items.filter((c) => c.tagIds.includes(4)).length).toBeGreaterThan(0);
    const search = parseListing(fixture('search-english.html'), 1);
    expect(search.items).toHaveLength(25);
    expect(search.hasMore).toBe(true);
  });

  it('reads a whole gallery from the reader page JSON', () => {
    const g = parseReaderPage(fixture('reader-699591-1.html'));
    expect(g).not.toBeNull();
    expect(g?.id).toBe('699591');
    expect(g?.pages).toHaveLength(53);
    expect(g?.pages[0]).toEqual({
      n: 1,
      url: 'https://3-hentai.xyz/4327126/1.webp',
      thumb: 'https://3-hentai.xyz/4327126/1t.webp',
      width: expect.any(Number),
      height: expect.any(Number),
    });
    expect(g?.cover).toBe('https://3-hentai.xyz/4327126/cover.webp');
    // The host can answer a missing cover with a "not found" page labelled as an image, so the
    // client tries these in order, ending with the first page.
    expect(g?.coverFallbacks).toEqual([
      'https://3-hentai.xyz/4327126/cover.jpg',
      'https://3-hentai.xyz/4327126/thumb.webp',
      'https://3-hentai.xyz/4327126/thumb.jpg',
      'https://3-hentai.xyz/4327126/1t.webp',
      'https://3-hentai.xyz/4327126/1.webp',
    ]);
    expect(g?.tags).toContainEqual(expect.objectContaining({ kind: 'artist', slug: 'orita', name: 'orita' }));
    expect(g?.tags).toContainEqual(expect.objectContaining({ kind: 'category', slug: 'doujinshi' }));
    expect(g?.tags.every((t) => t.id !== null)).toBe(true);
    expect(g?.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('falls back to the info page when the reader JSON is missing', () => {
    expect(parseReaderPage('<html><script>var x = 1;</script></html>')).toBeNull();
    const g = parseGalleryPage(fixture('gallery-699591.html'), '699591');
    expect(g?.pages).toHaveLength(53);
    expect(g?.pages[1]?.url).toBe('https://3-hentai.xyz/4327126/2.webp');
    expect(g?.coverFallbacks).toEqual(['https://3-hentai.xyz/4327126/1t.webp', 'https://3-hentai.xyz/4327126/1.webp']);
    expect(g?.tags.map((t) => t.kind)).toEqual(
      expect.arrayContaining(['tag', 'artist', 'parody', 'group', 'language', 'category']),
    );
    expect(g?.uploadedAt).toMatch(/^\d{4}-/);
  });

  it('reads an A–Z index page', () => {
    const index = parseIndexPage(fixture('tags-index.html'), 1);
    // 300 links, some listed twice (a popular block repeats them); each name appears once.
    expect(index.items).toHaveLength(290);
    expect(new Set(index.items.map((t) => t.slug)).size).toBe(290);
    expect(index.items[0]).toEqual({ kind: 'tag', slug: '0-shift', name: '0 shift', count: 1, id: null });
    expect(index.lastPage).toBe(26);
  });

  it('reads counts and tag links', () => {
    expect(parseQty('21K')).toBe(21_000);
    expect(parseQty('1.2M')).toBe(1_200_000);
    expect(parseQty('7')).toBe(7);
    expect(parseQty('x')).toBeNull();
    expect(tagLinkOf('/tag/big-breasts/')).toEqual({ kind: 'tag', slug: 'big-breasts' });
    expect(tagLinkOf('/artist/orita/')).toEqual({ kind: 'artist', slug: 'orita' });
    expect(tagLinkOf('/d/1/')).toBeNull();
    expect(tagLinkOf('https://evil.example/tag/x/')).toBeNull();
  });
});

describe('3hentai.to addresses', () => {
  it('requests only catalogue pages', () => {
    const ok = (path: string) => isAllowedAddress(new URL(path, SITE));
    expect(ok('/kai')).toBe(true);
    expect(ok('/kai?page=2&sort=popular')).toBe(true);
    expect(ok('/search/?q=tag%3Ayuri&page=3')).toBe(true);
    expect(ok('/d/699591/')).toBe(true);
    expect(ok('/d/699591/1/')).toBe(true);
    expect(ok('/tag/big-breasts/?sort=popular-7d')).toBe(true);
    expect(ok('/tags/?letter=%23&sort=popular')).toBe(true);
    expect(ok('/api/autocomplete')).toBe(false);
    expect(ok('/login/')).toBe(false);
    expect(ok('/kai?q=x')).toBe(false);
    expect(ok('/kai?sort=random')).toBe(false);
    expect(ok('/tag/../login/')).toBe(false);
    expect(isAllowedAddress(new URL('https://evil.example/kai'))).toBe(false);
  });

  it('builds list addresses', () => {
    expect(listAddress({ by: 'browse', sort: 'new', page: 1 })).toBe('/kai');
    expect(listAddress({ by: 'browse', sort: 'popular', page: 2 })).toBe('/kai?sort=popular&page=2');
    expect(listAddress({ by: 'search', q: 'tag:yuri', page: 1 })).toBe('/search/?q=tag%3Ayuri');
    expect(listAddress({ by: 'artist', slug: 'orita', sort: '24h', page: 3 })).toBe(
      '/artist/orita/?sort=popular-24h&page=3',
    );
  });
});

describe('3hentai.to client', () => {
  it('backs off after a bot check and never retries through it', async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    const site = agent.get(SITE);
    site.intercept({ path: '/kai', method: 'GET' }).reply(503, '<title>Just a moment...</title>');
    let now = 0;
    const client = new ThreehentaiClient(agent, {
      gapMs: 0,
      listingTtlMs: 60_000,
      galleryTtlMs: 60_000,
      indexTtlMs: 60_000,
      now: () => now,
    });
    await expect(client.page('/kai')).rejects.toMatchObject({ status: 503 });
    // Paused: no request is made (an unmatched request would throw a different error).
    await expect(client.page('/kai')).rejects.toMatchObject({ status: 503, publicMessage: expect.stringMatching(/limiting/) });
    now += 16 * 60_000;
    site.intercept({ path: '/kai', method: 'GET' }).reply(200, '<html></html>');
    await expect(client.page('/kai')).resolves.toBe('<html></html>');
    // Cached: answered without another request.
    await expect(client.page('/kai')).resolves.toBe('<html></html>');
  });

  it('refuses addresses outside the allow-list before any request', () => {
    const client = new ThreehentaiClient(new MockAgent(), { gapMs: 0, listingTtlMs: 0, galleryTtlMs: 0, indexTtlMs: 0 });
    expect(() => client.page('/api/autocomplete')).toThrow(/not part of the catalogue/);
  });
});
