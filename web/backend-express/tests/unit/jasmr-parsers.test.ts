import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../src/models/echo/settings.js';
import {
  TitleTranslator,
  splitLongText,
  retitle,
  translateDescription,
} from '../../src/extension/jasmr/translation.js';
import { readPlaylist } from '../../src/extension/jasmr/parsers/playlist.js';
import {
  parseLabel,
  parseListing,
  workIdFromUrl,
} from '../../src/extension/jasmr/parsers/listing.js';
import { parsePost } from '../../src/extension/jasmr/parsers/post.js';
import { parseFeatured, parseTermIndex } from '../../src/extension/jasmr/parsers/index-pages.js';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '..', 'fixtures', 'jasmr', name), 'utf8');

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

/** Markup as on the site's /cv/, /circles/ and /tags/ pages. */
const indexEntry = (href: string, count: number, name: string) =>
  `<span class="tag-groups-tag" style="font-size:12px"><a href="${href}" title="(${count})" class="x"><span class="tag-groups-label" style="font-size:12px">${name}</span></a></span>`;

describe('japaneseasmr index pages', () => {
  it('lists entries most works first, keeping each path once with its highest count', () => {
    const html = `<div>
      ${indexEntry('https://japaneseasmr.com/tag/wife/', 23, 'wife')}
      ${indexEntry('https://japaneseasmr.com/tag/yuka-hinata/', 1233, 'Yuka Hinata 【陽向葵ゅか】')}
      ${indexEntry('https://japaneseasmr.com/category/%e3%83%86%e3%82%b0/', 496, 'テグ')}
      ${indexEntry('https://japaneseasmr.com/tag/wife/', 20, 'wife')}
      ${indexEntry('https://otomekoe.moe/category/BL/', 999, 'elsewhere')}
      <span class="tag-groups-tag"><a href="https://japaneseasmr.com/tag/no-count/">no count</a></span>
    </div>`;
    expect(parseTermIndex(html)).toEqual([
      { path: '/tag/yuka-hinata/', name: 'Yuka Hinata 【陽向葵ゅか】', count: 1233 },
      { path: '/category/%e3%83%86%e3%82%b0/', name: 'テグ', count: 496 },
      { path: '/tag/wife/', name: 'wife', count: 23 },
    ]);
  });

  it('reads the Featured Posts box: work ids and lazily loaded covers', () => {
    const html = `<div class="widget widget_text clearfix"><p class="widget-title">Featured Posts</p><div class="textwidget">
      <p><a href="https://japaneseasmr.com/138259/"><img class="lazy" src="data:image/svg+xml,x" data-src="https://pic.weeabo0.xyz/RJ01473335_img_main.jpg" /></a></p>
      <p><a href="https://japaneseasmr.com/150849/"><img src="https://pic.weeabo0.xyz/other.jpg" /></a></p>
      <p><a href="https://japaneseasmr.com/138259/"><img data-src="https://pic.weeabo0.xyz/RJ01473335_img_main.jpg" /></a></p>
    </div></div>
    <div class="widget"><p class="widget-title">Something else</p><a href="https://japaneseasmr.com/1/">x</a></div>`;
    expect(parseFeatured(html)).toEqual([
      {
        workId: '138259',
        cover: 'https://pic.weeabo0.xyz/RJ01473335_img_main.jpg',
        rjCode: 'RJ01473335',
      },
      { workId: '150849', cover: 'https://pic.weeabo0.xyz/other.jpg', rjCode: null },
    ]);
  });

  it('finds no featured works on a page without the box', () => {
    expect(parseFeatured(fixture('listing-page-2.html'))).toEqual([]);
  });
});

describe('japaneseasmr title translation', () => {
  const settings = (values: Record<string, unknown>): Settings =>
    ({
      getString: (k: string) => (typeof values[k] === 'string' ? values[k] : null),
      getBoolean: (k: string) => (typeof values[k] === 'boolean' ? values[k] : null),
    }) as unknown as Settings;
  const fake = vi.fn((list: readonly string[], _language: { code: string }) =>
    Promise.resolve(new Map(list.map((t) => [t, `EN:${t}`]))),
  );

  it('translates a batch once, into the Translation Language, skipping blanks and duplicates', async () => {
    fake.mockClear();
    const t = await new TitleTranslator(() => settings({ translationLanguage: 'en' }), fake).lookup(
      ['猫', '猫', ' ', '犬'],
    );
    expect(t('猫')).toBe('EN:猫');
    expect(t('unknown')).toBe('unknown');
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake.mock.calls[0]?.[0]).toEqual(['猫', '犬']);
    expect(fake.mock.calls[0]?.[1]).toMatchObject({ code: 'en' });
  });

  it('does nothing when switched off or when the target is Japanese', async () => {
    fake.mockClear();
    const off = await new TitleTranslator(
      () => settings({ jasmrTranslateTitles: false }),
      fake,
    ).lookup(['猫']);
    const ja = await new TitleTranslator(
      () => settings({ translationLanguage: 'ja' }),
      fake,
    ).lookup(['猫']);
    expect([off('猫'), ja('猫')]).toEqual(['猫', '猫']);
    expect(fake).not.toHaveBeenCalled();
  });

  it('keeps originals when translation fails', async () => {
    const t = await new TitleTranslator(
      () => null,
      () => Promise.resolve(null),
    ).lookup(['猫']);
    expect(t('猫')).toBe('猫');
  });

  it('keeps the original title in extras and translates descriptions line by line', () => {
    const t = (s: string) => `EN:${s}`;
    expect(retitle({ title: '猫', extras: { rjCode: 'RJ1' } }, t)).toEqual({
      title: 'EN:猫',
      extras: { rjCode: 'RJ1', originalTitle: '猫' },
    });
    const same = { title: 'x', extras: {} };
    expect(retitle(same, (s) => s)).toBe(same);
    expect(translateDescription('一行目\n\n二行目', t)).toBe('EN:一行目\n\nEN:二行目');
  });
});

describe('japaneseasmr playlist and long text helpers', () => {
  it('adds up a media playlist and points to the first variant of a master playlist', () => {
    expect(
      readPlaylist('#EXTM3U\n#EXTINF:10.005333,\na.ts\n#EXTINF:9.984,\nb.ts\n', 'https://x/p.m3u8'),
    ).toEqual({ seconds: 19.989 });
    expect(
      readPlaylist(
        '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nlow/index.m3u8\n',
        'https://x/a/p.m3u8',
      ),
    ).toEqual({ variant: 'https://x/a/low/index.m3u8' });
    expect(readPlaylist('not a playlist', 'https://x/p.m3u8')).toBeNull();
  });

  it('splits long text into sentence pieces under the limit', () => {
    const sentence = 'あ'.repeat(40) + '。';
    const pieces = splitLongText(sentence.repeat(30), 200);
    expect(pieces.every((p) => p.length <= 200)).toBe(true);
    expect(pieces.join('')).toBe(sentence.repeat(30));
    expect(splitLongText('short')).toEqual(['short']);
    // A sentence longer than the limit is cut at a comma, or at the limit.
    const long = splitLongText('い'.repeat(150) + '、' + 'う'.repeat(150), 200);
    expect(long).toEqual(['い'.repeat(150) + '、', 'う'.repeat(150)]);
  });

  it('translates long texts piece by piece and joins them', async () => {
    const translate = vi.fn((list: readonly string[], _language: { code: string }) =>
      Promise.resolve(new Map(list.map((t) => [t, `[${String(t.length)}]`]))),
    );
    const text = ('え'.repeat(299) + '。').repeat(3);
    const t = await new TitleTranslator(() => null, translate).lookup([text]);
    expect(t(text)).toBe('[600] [300]');
  });

  it('keeps line breaks in a work description', () => {
    const html =
      '<div itemprop="description"><p>コンセプト<br>元・トップ嬢:雪姫</p><p>  VS   現役風俗嬢 </p><div>最後</div></div>';
    expect(parsePost(html, '1').description).toBe(
      'コンセプト\n元・トップ嬢:雪姫\nVS 現役風俗嬢\n最後',
    );
  });
});
