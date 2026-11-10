import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLabel, parseListing, workIdFromUrl } from '../../src/extension/jasmr/parsers/listing.js';
import { parsePost } from '../../src/extension/jasmr/parsers/post.js';

const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', 'jasmr', name), 'utf8');

describe('japaneseasmr listing parser', () => {
  const listing = parseListing(fixture('listing-page-2.html'), 2);

  it('reads one card per post, with work id, title and cover', () => {
    expect(listing.cards).toHaveLength(3);
    expect(listing.cards[0]?.workId).toBe('151979');
    const first = listing.cards[0]!;
    expect(first.title).toContain('二択回答式');
    expect(first.cover).toBe('https://pic.weeabo0.xyz/RJ01746828_img_main.jpg');
  });

  it('reads circle, RJ code, cast and date from the label line', () => {
    const first = listing.cards[0]!;
    expect(first.circle).toBe('うさねまい');
    expect(first.rjCode).toBe('RJ01746828');
    expect(first.cv).toEqual(['Noah Hakogawa']);
    expect(first.date).toBe('2026-11-05');
  });

  it('reads categories with the slug that the circle page uses', () => {
    const categories = listing.cards[0]!.categories;
    expect(categories.map((c) => c.name)).toEqual(['NSFW', 'Requested', 'うさねまい']);
    expect(categories[2]?.slug).toBe('%e3%81%86%e3%81%95%e3%81%ad%e3%81%be%e3%81%84');
  });

  it('gives the next page number when a later page is linked, and null on the last page', () => {
    expect(listing.nextPage).toBe(3);
    expect(parseListing(fixture('listing-page-2.html'), 2476).nextPage).toBeNull();
  });
});

describe('japaneseasmr work parser', () => {
  const post = parsePost(fixture('post-151994.html'), '151994');

  it('reads title, circle, RJ code and cast', () => {
    expect(post.title).toContain('リリィプリンセス');
    expect(post.title).not.toContain('Japanese ASMR');
    expect(post.circle).toBe('ゆりしすたーず');
    expect(post.rjCode).toBe('RJ01755181');
    expect(post.cv).toEqual(['Kosuzu Momoka', 'Gemiko Yamada', '飴屋ぺろり']);
  });

  it('reads the cover, date and description', () => {
    expect(post.cover).toBe('https://pic.weeabo0.xyz/RJ01755181_img_main.jpg');
    expect(post.date).toBe('2026-11-05');
    expect(post.description).toMatch(/^コンセプト/);
  });

  it('reads the single HLS stream of the work', () => {
    expect(post.streamUrl).toBe('https://v.weeab0o.xyz/RJ01755181.m3u8');
  });

  it('reads chapters in order with their start offsets in seconds', () => {
    expect(post.chapters).toHaveLength(16);
    expect(post.chapters[0]).toEqual({ index: 0, title: '01 （EX1）ゆきの決意', start: 0 });
    expect(post.chapters[2]).toEqual({ index: 2, title: '03 レズバトル開始', start: 544 });
    expect(post.chapters.map((c) => c.index)).toEqual(post.chapters.map((_, i) => i));
  });
});

describe('small parsing helpers', () => {
  it('reads the work id from post URLs', () => {
    expect(workIdFromUrl('https://japaneseasmr.com/151994/')).toBe('151994');
    expect(workIdFromUrl('https://japaneseasmr.com/category/futanari/')).toBeNull();
  });

  it('splits the label into circle and RJ code', () => {
    expect(parseLabel('[261031][ゆりしすたーず] 【KU100】作品 [RJ01755181]')).toEqual({
      circle: 'ゆりしすたーず',
      rjCode: 'RJ01755181',
    });
  });
});
