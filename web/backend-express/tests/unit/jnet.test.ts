import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MockAgent } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JnetExtension } from '../../src/extension/jnet/jnet.extension.js';
import { decodeStreamId, streamId, workCodeOf } from '../../src/extension/jnet/constants.js';
import {
  pickText,
  parseSeconds,
  plainDescription,
  videoToAlbum,
  videoToTracks,
} from '../../src/extension/jnet/mappers.js';
import { videoSchema } from '../../src/extension/jnet/api/schemas.js';
import { TitleTranslator } from '../../src/extension/jasmr/translation.js';
import type { Settings } from '../../src/models/echo/settings.js';
import { makeAlbum, type Artist } from '../../src/models/echo/media.js';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '..', 'fixtures', 'jnet', name), 'utf8');
const SITE = 'https://www.jasmr.net';

/** Settings with a translation language, as the app stores them. */
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

/** Records and fakes the translator: every text becomes "EN:<text>". */
function fakeTranslator() {
  const translate = vi.fn((list: readonly string[]) =>
    Promise.resolve(new Map(list.map((t) => [t, `EN:${t}`]))),
  );
  return { translator: new TitleTranslator(() => null, translate), translate };
}

describe('jasmr.net title and text helpers', () => {
  it('shows the site translation for the chosen language, else English, else Japanese (translated)', () => {
    const title = { english: 'Cat', japanese: '猫', chinese: '', korean: null, spanish: '' };
    expect(pickText(title, 'en')).toEqual({ text: 'Cat', needsTranslation: false });
    expect(pickText(title, 'ja')).toEqual({ text: '猫', needsTranslation: false });
    expect(pickText(title, 'zh')).toEqual({ text: 'Cat', needsTranslation: false });
    expect(pickText({ japanese: '猫' }, 'en')).toEqual({ text: '猫', needsTranslation: true });
    expect(pickText({ japanese: '猫' }, 'ja')).toEqual({ text: '猫', needsTranslation: false });
    // A language the site doesn't provide goes through the translator.
    expect(pickText(title, 'fr')).toEqual({ text: 'Cat', needsTranslation: true });
  });

  it('reads durations and drops markdown from descriptions', () => {
    expect(parseSeconds('1:48:03')).toBe(6483);
    expect(parseSeconds('12:05')).toBe(725);
    expect(parseSeconds('nope')).toBeNull();
    expect(parseSeconds(null)).toBeNull();
    expect(plainDescription('# Synopsis\nChosen\n\n## Story\nB')).toBe(
      'Synopsis\nChosen\nStory\nB',
    );
  });
});

describe('jasmr.net tracks and their offsets in the work file', () => {
  it('starts each track where the previous one ends when the lengths match the file', () => {
    const video = videoSchema.parse(JSON.parse(fixture('video-RJ01670247.json')));
    const album = videoToAlbum(video, { title: 'Work', originalTitle: 'Work' }, null);
    const tracks = videoToTracks(video, album, ['A', 'B', 'C']);
    expect(tracks.map((t) => [t.id, t.extras.start, t.extras.end, t.duration])).toEqual([
      ['jnet:RJ01670247#0', '0', '3138', 3_138_000],
      ['jnet:RJ01670247#1', '3138', '6276', 3_138_000],
      ['jnet:RJ01670247#2', '6276', '6483', 207_000],
    ]);
    expect(tracks.map((t) => t.title)).toEqual(['A', 'B', 'C']);
    expect(tracks[0]?.streamables).toHaveLength(1);
  });

  it('treats the file as one track when the track lengths do not match its length', () => {
    const video = videoSchema.parse(JSON.parse(fixture('video-RJ436385.json')));
    const album = videoToAlbum(video, { title: 'Work', originalTitle: 'Work' }, null);
    const tracks = videoToTracks(video, album, []);
    expect(tracks).toHaveLength(1);
    expect(tracks[0]?.id).toBe('jnet:RJ436385#0');
    expect(tracks[0]?.extras).toEqual({ start: '0', chapter: '0' });
    expect(tracks[0]?.duration).toBe(6_628_000);
  });

  it('keeps the work and stream ids round-trippable and refuses foreign addresses', () => {
    expect(workCodeOf('jnet:RJ01670247#2')).toBe('RJ01670247');
    const url = `${SITE}/media/audio/RJ01670247.m4a`;
    expect(decodeStreamId(streamId(url))).toBe(url);
    expect(decodeStreamId(streamId('https://evil.example/media/audio/x.m4a'))).toBeNull();
    expect(decodeStreamId(streamId(`${SITE}/api/v1/status`))).toBeNull();
  });
});

describe('jasmr.net through the extension', () => {
  let agent: MockAgent;
  let ext: JnetExtension;

  beforeEach(() => {
    agent = new MockAgent();
    agent.disableNetConnect();
    const { translator } = fakeTranslator();
    ext = new JnetExtension(agent, { gapMs: 0, cacheTtlMs: 0, translator });
    ext.setSettings(settingsFor('en'));
  });

  function api() {
    return agent.get(SITE);
  }

  it('builds the home screen from buckets, latest, most liked and tags', async () => {
    api()
      .intercept({ path: '/api/v1/home', method: 'GET' })
      .reply(200, fixture('home.json'), { headers: { 'content-type': 'application/json' } });
    api()
      .intercept({ path: /sort=dateDescending/, method: 'GET' })
      .reply(200, fixture('search-binaural.json'), {
        headers: { 'content-type': 'application/json' },
      })
      .persist();
    api()
      .intercept({ path: /sort=likesDescending/, method: 'GET' })
      .reply(200, fixture('search-binaural.json'), {
        headers: { 'content-type': 'application/json' },
      })
      .persist();
    api()
      .intercept({ path: '/api/v1/tags', method: 'GET' })
      .reply(200, fixture('tags.json'), { headers: { 'content-type': 'application/json' } });

    const feed = await ext.loadHomeFeed();
    const shelves = await feed.getPagedData(null).then((d) => d.pagedData.loadAll());
    expect(shelves[0]).toMatchObject({ shelfKind: 'Items', title: 'Healing & ASMR' });
    const latest = shelves.find((s) => s.shelfKind === 'Items' && s.id === 'latest');
    const liked = shelves.find((s) => s.shelfKind === 'Items' && s.id === 'liked');
    expect(latest).toBeDefined();
    expect(liked).toBeDefined();
    const tags = shelves.find((s) => s.shelfKind === 'Categories' && s.id === 'tags');
    expect(tags?.shelfKind === 'Categories' && tags.list).toHaveLength(40);
    // Most used tag first, by its English name.
    const top = (
      JSON.parse(fixture('tags.json')) as { name: { english: string }; videoCount: number }[]
    ).sort((x, y) => y.videoCount - x.videoCount)[0];
    expect(tags?.shelfKind === 'Categories' && tags.list[0]?.title).toBe(top?.name.english);
  });

  it('searches with the site’s own search and pages on from the total', async () => {
    api()
      .intercept({
        path: /search=Binaural/,
        method: 'GET',
      })
      .reply(200, fixture('search-binaural.json'), {
        headers: { 'content-type': 'application/json' },
      });
    const feed = await ext.loadSearchFeed('Binaural');
    const page = await feed.getPagedData(null).then((d) => d.pagedData.loadPage(null));
    expect(page.data).toHaveLength(3);
    expect(page.data[0]).toMatchObject({
      shelfKind: 'Item',
      media: { id: 'jnet:RJ01017541', kind: 'Album' },
    });
    // 937 results at 24 per page: there is a next page.
    expect(page.continuation).toBe('2');
  });

  it('loads a work, its localized title and its tracks with stream addresses', async () => {
    api()
      .intercept({ path: '/api/v1/videos?code=RJ01670247', method: 'GET' })
      .reply(200, fixture('video-RJ01670247.json'), {
        headers: { 'content-type': 'application/json' },
      })
      .persist();
    const album = makeAlbum({ id: 'jnet:RJ01670247', title: '', artists: [], extras: {} });

    const work = await ext.loadAlbum(album);
    expect(work.title).toBe(
      "The Snake God's Ruined Fellatio: Toyed with by Hallucinations and a Split Tongue",
    );
    expect(work.extras.originalTitle).toMatch(/^【5方向責め】/);
    expect(work.artists[0]).toMatchObject({ name: 'FemdomAtelier' });
    expect(work.duration).toBe(6_483_000);
    expect(work.description).toMatch(/^Synopsis\n/);

    const tracks = await ext
      .loadAlbumTracks(work)
      .then((f) => f!.getPagedData(null).then((d) => d.pagedData.loadAll()));
    expect(tracks).toHaveLength(3);
    expect(tracks[1]?.extras).toMatchObject({ start: '3138', end: '6276' });

    const media = await ext.loadStreamableMedia(tracks[1]!.streamables[0]!);
    expect(media.mediaKind).toBe('Server');
    if (media.mediaKind !== 'Server') return;
    expect(media.sources[0]?.request.url).toBe(`${SITE}/media/audio/RJ01670247.m4a`);
    expect(media.sources[0]?.request.headers).toEqual({ 'User-Agent': 'EchoASMR/1.0' });
    expect(media.sources[0]?.type).toBe('Progressive');
  });

  it('lists a circle’s works by its name', async () => {
    api()
      .intercept({ path: /search=%2B%22FemdomAtelier%22/, method: 'GET' })
      .reply(200, fixture('search-binaural.json'), {
        headers: { 'content-type': 'application/json' },
      });
    const artist = {
      kind: 'Artist',
      id: 'jnet:circle:FemdomAtelier',
      name: 'FemdomAtelier',
    } as unknown as Artist;
    const feed = await ext.loadArtistFeed(artist);
    const page = await feed.getPagedData(null).then((d) => d.pagedData.loadPage(null));
    expect(page.data.length).toBeGreaterThan(0);
  });

  it('backs off after a block page and does not contact the site again straight away', async () => {
    api()
      .intercept({ path: /^\/api\/v1\/search\?/, method: 'GET' })
      .reply(403, '<html>Just a moment…</html>', { headers: { 'content-type': 'text/html' } });
    const first = ext.quickSearch('x');
    await expect(first).rejects.toMatchObject({ status: 503, errorType: 'upstream' });
    // A second request inside the pause is refused locally: no request reaches the mock agent.
    await expect(ext.quickSearch('y')).rejects.toThrow(/limiting requests/);
  });
});
