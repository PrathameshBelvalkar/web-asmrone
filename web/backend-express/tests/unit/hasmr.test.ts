import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MockAgent } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isAllowedAddress } from '../../src/extension/hasmr/api/hasmr.client.js';
import { HasmrExtension } from '../../src/extension/hasmr/hasmr.extension.js';
import { decodeStreamId, streamId, workSlugOf } from '../../src/extension/hasmr/constants.js';
import { parseListing } from '../../src/extension/hasmr/parsers/listing.js';
import { parseActorList, parseTagCloud } from '../../src/extension/hasmr/parsers/index.js';
import { parseWork } from '../../src/extension/hasmr/parsers/work.js';
import {
  parseClock,
  parseCount,
  parseIsoDuration,
} from '../../src/extension/hasmr/parsers/common.js';
import { TitleTranslator } from '../../src/extension/jasmr/translation.js';
import type { Settings } from '../../src/models/echo/settings.js';
import { makeAlbum } from '../../src/models/echo/media.js';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '..', 'fixtures', 'hasmr', name), 'utf8');
const SITE = 'https://hentaiasmr.moe';
const WORK = '/rj01742594.html';

function settingsFor(language: string): Settings {
  const values: Record<string, string> = { translationLanguage: language };
  return {
    getString: (key: string) => values[key] ?? null,
    putString: () => undefined,
    getStringSet: () => null,
    putStringSet: () => undefined,
    getInt: () => null,
    putInt: () => undefined,
    getBoolean: () => null,
    putBoolean: () => undefined,
  };
}

describe('hentaiasmr.moe parsers', () => {
  it('reads the works on a listing page and the link to the next page', () => {
    const listing = parseListing(fixture('listing-page-2.html'), `${SITE}/page/2`);
    expect(listing.cards).toHaveLength(18);
    expect(listing.cards[0]?.slug).toBe('rj01748880');
    expect(listing.cards[0]?.title).toBe(
      '保健室で出会った人見知りの色白爆乳彼女と秘密のあまあま純愛生活',
    );
    expect(listing.cards[0]?.views).toBe(864);
    expect(listing.cards[0]?.durationSec).toBe(6598);
    expect(listing.cards[0]?.cover).toMatch(/^https:\/\/hentaiasmr\.moe\/wp-content\//);
    expect(listing.nextUrl).toBe(`${SITE}/page/3`);
  });

  it('never picks up the hidden trap page from the front page', () => {
    const listing = parseListing(fixture('home.html'), SITE);
    expect(listing.cards.length).toBeGreaterThan(0);
    expect(listing.cards.some((card) => /honeypot/i.test(card.slug))).toBe(false);
  });

  it('reads a work: circle, cast, categories, tags, length and its MP3 tracks only', () => {
    const work = parseWork(fixture('work-rj01742594.html'), `${SITE}${WORK}`);
    expect(work.postId).toBe('165721');
    expect(work.title).toBe(
      'クールダウナー軍隊長の性的な常識を改変し、部下への性処理生ハメを当然と思い込ませいつでも使える生コキおまんこへ',
    );
    expect(work.circle).toBe('Atolie Stars');
    expect(work.voices).toEqual(['こやまはる', 'Haru Koyama']);
    expect(work.categories.map((c) => c.name)).toContain('Atolie Stars');
    expect(work.tags.length).toBeGreaterThan(0);
    expect(work.actors).toEqual([expect.objectContaining({ name: 'こやまはる' })]);
    expect(work.durationSec).toBe(5221);
    expect(work.tracks).toHaveLength(7);
    expect(work.tracks[0]).toEqual({
      number: 1,
      url: 'https://cdn.hentaiasmr.moe/mf/165721/1.mp3',
    });
    // The embedded ad videos come from other hosts and are never played.
    expect(work.tracks.every((t) => t.url.startsWith('https://cdn.hentaiasmr.moe/'))).toBe(true);
  });

  it('weighs the tag cloud by its font size and reads the actor list', () => {
    const tags = parseTagCloud(fixture('tags.html'));
    expect(tags.length).toBeGreaterThan(900);
    expect(tags[0]?.weight).toBeGreaterThanOrEqual(tags[1]?.weight ?? 0);
    const actors = parseActorList(fixture('voice-actors.html'));
    expect(actors.length).toBeGreaterThan(0);
    expect(actors.every((a) => a.name !== '?')).toBe(true);
  });

  it('reads counts, clocks and ISO durations', () => {
    expect(parseCount('864')).toBe(864);
    expect(parseCount('1K')).toBe(1000);
    expect(parseCount('2.5K')).toBe(2500);
    expect(parseCount(null)).toBeNull();
    expect(parseClock('01:27:01')).toBe(5221);
    expect(parseClock('12:05')).toBe(725);
    expect(parseIsoDuration('PT01H27M01S')).toBe(5221);
    expect(parseIsoDuration('nope')).toBeNull();
  });
});

describe('hentaiasmr.moe address allow-list and streams', () => {
  it('requests only catalogue pages, never the trap or anything off-site', () => {
    expect(isAllowedAddress(new URL('/', SITE))).toBe(true);
    expect(isAllowedAddress(new URL('/page/2', SITE))).toBe(true);
    expect(isAllowedAddress(new URL(WORK, SITE))).toBe(true);
    expect(isAllowedAddress(new URL('/category/otome/page/2', SITE))).toBe(true);
    expect(isAllowedAddress(new URL('/?s=abc', SITE))).toBe(true);
    expect(isAllowedAddress(new URL('/?filter=most-viewed', SITE))).toBe(true);
    expect(isAllowedAddress(new URL('/honeypot-c1234leaks434', SITE))).toBe(false);
    expect(isAllowedAddress(new URL('/wp-admin/', SITE))).toBe(false);
    expect(isAllowedAddress(new URL('/?filter=random', SITE))).toBe(false);
    expect(isAllowedAddress(new URL('https://evil.example/', SITE))).toBe(false);
  });

  it('plays only the site’s own MP3 files', () => {
    const mp3 = 'https://cdn.hentaiasmr.moe/mf/165721/1.mp3';
    expect(decodeStreamId(streamId(mp3))).toBe(mp3);
    expect(decodeStreamId(streamId('https://www.dismal-library.pro/301305/x.webm'))).toBeNull();
    expect(decodeStreamId(streamId('https://cdn.hentaiasmr.moe/mf/165721/1.webm'))).toBeNull();
    expect(workSlugOf('hasmr:rj01742594#3')).toBe('rj01742594');
  });
});

describe('hentaiasmr.moe through the extension', () => {
  let agent: MockAgent;
  let ext: HasmrExtension;

  beforeEach(() => {
    agent = new MockAgent();
    agent.disableNetConnect();
    const translate = vi.fn((list: readonly string[]) =>
      Promise.resolve(new Map(list.map((t) => [t, `EN:${t}`]))),
    );
    ext = new HasmrExtension(agent, {
      gapMs: 0,
      cacheTtlMs: 0,
      translator: new TitleTranslator(() => null, translate),
    });
    ext.setSettings(settingsFor('en'));
  });

  const site = () => agent.get(SITE);
  const html = { 'content-type': 'text/html; charset=utf-8' };

  it('opens a work with translated title, circle, cast and length', async () => {
    site()
      .intercept({ path: WORK, method: 'GET' })
      .reply(200, fixture('work-rj01742594.html'), { headers: html })
      .persist();
    const stub = makeAlbum({ id: 'hasmr:rj01742594', title: '', artists: [], extras: {} });
    const work = await ext.loadAlbum(stub);
    expect(work.title).toMatch(/^EN:クールダウナー/);
    expect(work.extras.originalTitle).toMatch(/^クールダウナー/);
    expect(work.artists.map((a) => a.name)).toEqual(
      expect.arrayContaining(['Atolie Stars', 'こやまはる']),
    );
    expect(work.duration).toBe(5_221_000);
    expect(work.trackCount).toBe(7);
  });

  it('plays each MP3 as a track, with the headers the audio host expects', async () => {
    site()
      .intercept({ path: WORK, method: 'GET' })
      .reply(200, fixture('work-rj01742594.html'), { headers: html })
      .persist();
    const stub = makeAlbum({ id: 'hasmr:rj01742594', title: '', artists: [], extras: {} });
    const feed = await ext.loadAlbumTracks(stub);
    const tracks = await feed!.getPagedData(null).then((d) => d.pagedData.loadAll());
    expect(tracks).toHaveLength(7);
    expect(tracks[0]?.id).toBe('hasmr:rj01742594#1');
    expect(tracks[0]?.title).toBe('Track 1');

    const media = await ext.loadStreamableMedia(tracks[0]!.streamables[0]!);
    if (media.mediaKind !== 'Server') throw new Error('expected a server stream');
    const request = media.sources[0]!.request;
    expect(request.url).toBe('https://cdn.hentaiasmr.moe/mf/165721/1.mp3');
    expect(request.headers).toEqual({
      Referer: 'https://hentaiasmr.moe/',
      Accept: '*/*',
      'User-Agent': 'EchoASMR/1.0',
    });
  });

  it('refuses a work address that is not part of the catalogue, without a request', async () => {
    const stub = makeAlbum({
      id: 'hasmr:honeypot-c1234leaks434',
      title: '',
      artists: [],
      extras: {},
    });
    await expect(ext.loadAlbum(stub)).rejects.toThrow(/not part of the catalogue/);
  });

  it('builds the home screen one row at a time, starting with Latest and categories', async () => {
    site()
      .intercept({ path: '/', method: 'GET' })
      .reply(200, fixture('home.html'), { headers: html })
      .persist();
    const feed = await ext.loadHomeFeed();
    const first = await feed.getPagedData(null).then((d) => d.pagedData.loadPage(null));
    expect(first.continuation).toBe('weekly');
    const latest = first.data.find((s) => s.shelfKind === 'Items' && s.id === 'latest');
    expect(latest).toBeDefined();
    const categories = first.data.find(
      (s) => s.shelfKind === 'Categories' && s.id === 'categories',
    );
    expect(categories?.shelfKind === 'Categories' && categories.list.map((c) => c.id)).toEqual([
      'category:otome',
      'category:erovoice',
      'category:english',
      'category:chinese',
    ]);
  });

  it('pauses after a block page and does not ask again straight away', async () => {
    site()
      .intercept({ path: WORK, method: 'GET' })
      .reply(403, '<html>Just a moment…</html>', { headers: html })
      .persist();
    const stub = makeAlbum({ id: 'hasmr:rj01742594', title: '', artists: [], extras: {} });
    await expect(ext.loadAlbum(stub)).rejects.toMatchObject({ status: 503 });
    await expect(ext.loadAlbum(stub)).rejects.toThrow(/limiting requests/);
  });
});
