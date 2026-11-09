import { MockAgent, type Interceptable } from 'undici';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AsmrOneExtension } from '../../src/extension/asmrone/asmr-one.extension.js';
import { configureTranslator } from '../../src/extension/asmrone/translation/gtx-translator.js';
import { makeAlbum, makePlaylist, makeTrack, type Track } from '../../src/models/echo/media.js';
import { serverStreamable } from '../../src/models/echo/streamable.js';
import type { Settings } from '../../src/models/echo/settings.js';
import { TAGS, TREE, work, worksResponse } from '../helpers/asmr-fixtures.js';

/** Plain in-memory settings for the extension. */
class MemorySettings implements Settings {
  private readonly values = new Map<string, unknown>();
  getString(k: string) { const v = this.values.get(k); return typeof v === 'string' ? v : null; }
  putString(k: string, v: string | null) { this.set(k, v); }
  getStringSet(k: string) { const v = this.values.get(k); return Array.isArray(v) ? new Set(v as string[]) : null; }
  putStringSet(k: string, v: ReadonlySet<string> | null) { this.set(k, v ? [...v] : null); }
  getInt(k: string) { const v = this.values.get(k); return typeof v === 'number' ? v : null; }
  putInt(k: string, v: number | null) { this.set(k, v); }
  getBoolean(k: string) { const v = this.values.get(k); return typeof v === 'boolean' ? v : null; }
  putBoolean(k: string, v: boolean | null) { this.set(k, v); }
  private set(k: string, v: unknown) { if (v === null) this.values.delete(k); else this.values.set(k, v); }
}

const agent = new MockAgent();
agent.disableNetConnect();
const api = agent.get('https://api.asmr-100.com');
const asmrOne = agent.get('https://api.asmr.one');
const translate = agent.get('https://translate.googleapis.com');

/** Translation is the identity: the query echoes back as one segment. */
function mockTranslator(): void {
  translate.intercept({ path: /translate_a\/single/, method: 'GET' }).reply(200, (opts) => {
    const q = new URL(opts.path, 'https://translate.googleapis.com').searchParams.get('q') ?? '';
    return JSON.stringify([[[q, q, null, null, 1]], null, 'en']);
  }).persist();
}

let settings: MemorySettings;
let ext: AsmrOneExtension;

beforeAll(() => {
  configureTranslator({ dispatcher: agent });
  mockTranslator();
});

afterAll(async () => {
  await agent.close();
});

beforeEach(() => {
  settings = new MemorySettings();
  ext = new AsmrOneExtension(agent);
  ext.setSettings(settings);
});

function tagsIntercept(i: Interceptable = api): void {
  i.intercept({ path: '/api/tags/', method: 'GET' }).reply(200, TAGS).persist();
}

describe('settings page', () => {
  it('lists the five settings with the documented defaults', async () => {
    tagsIntercept();
    const items = await ext.getSettingItems();
    expect(items.map((s) => s.key)).toEqual(['onlyShowSubtitled', 'onlyShowSfw', 'siteMirror', 'translationLanguage', 'showTags']);

    const mirror = items.find((s) => s.key === 'siteMirror');
    expect(mirror).toMatchObject({ kind: 'List', defaultEntryIndex: 0, entryValues: ['asmr-100', 'asmr-200', 'asmr-300'] });

    const language = items.find((s) => s.key === 'translationLanguage');
    if (language?.kind !== 'List') throw new Error('expected list');
    expect(language.entryValues[language.defaultEntryIndex ?? -1]).toBe('en');
    expect(language.entryTitles).not.toContain('AUTO');

    const tags = items.find((s) => s.key === 'showTags');
    expect(tags).toMatchObject({ kind: 'MultipleChoice', entryValues: ['Alpha', 'Zeta'], defaultEntryIndices: [] });
  });
});

describe('home feed', () => {
  it('skips a shelf the upstream fails, keeps the others, and shows the tags grid last', async () => {
    tagsIntercept();
    api.intercept({ path: '/api/recommender/popular', method: 'POST' }).reply(504, 'gateway');
    api.intercept({ path: '/api/recommender/recommend-for-user', method: 'POST' }).reply(200, worksResponse([work({ id: 1, title: 'One' })]));
    api.intercept({ path: /^\/api\/works\?/, method: 'GET' }).reply(200, worksResponse([work({ id: 2, title: 'Two' })]));

    const feed = await ext.loadHomeFeed();
    const [page] = await feed.getPagedData(null).then((d) => d.pagedData.loadAll().then((items) => [items]));
    const titles = (page ?? []).map((s) => (s.shelfKind === 'Items' || s.shelfKind === 'Categories' ? s.id : s.shelfKind));
    expect(titles).toEqual(['recommended', 'all', 'tags']);
  });

  it('a home-page tag shelf appears when its tag is selected', async () => {
    tagsIntercept();
    settings.putStringSet('showTags', new Set(['Alpha']));
    api.intercept({ path: /^\/api\/search\//, method: 'GET' }).reply(200, worksResponse([work({ id: 9, title: 'Tagged' })])).persist();
    api.intercept({ path: /^\/api\/recommender\//, method: 'POST' }).reply(200, worksResponse([])).persist();
    api.intercept({ path: /^\/api\/works\?/, method: 'GET' }).reply(200, worksResponse([])).persist();

    const feed = await ext.loadHomeFeed();
    const shelves = await feed.getPagedData(null).then((d) => d.pagedData.loadAll());
    const tagShelf = shelves.find((s) => s.shelfKind === 'Items' && s.id === 'tag_1');
    expect(tagShelf).toBeDefined();
    if (tagShelf?.shelfKind !== 'Items') throw new Error('expected items');
    expect(tagShelf.title).toBe('Alpha');
    expect(tagShelf.list[0]).toMatchObject({ kind: 'Album', id: '9', subtitle: '★★★★☆' });
  });
});

describe('home more pages (deliberate fix: starts at page 2)', () => {
  it('the More feed of a home shelf loads page 2 first, not page 1 again', async () => {
    // A private agent: the shared one carries persistent interceptors from earlier tests.
    const own = new MockAgent();
    own.disableNetConnect();
    configureTranslator({ dispatcher: own });
    const ownTranslate = own.get('https://translate.googleapis.com');
    ownTranslate.intercept({ path: /translate_a\/single/, method: 'GET' }).reply(200, (opts) => {
      const q = new URL(opts.path, 'https://translate.googleapis.com').searchParams.get('q') ?? '';
      return JSON.stringify([[[q, q, null, null, 1]], null, 'en']);
    }).persist();
    const ownApi = own.get('https://api.asmr-100.com');
    ownApi.intercept({ path: '/api/tags/', method: 'GET' }).reply(200, TAGS).persist();
    ownApi.intercept({ path: /^\/api\/recommender\//, method: 'POST' }).reply(200, worksResponse([])).persist();
    // Page 1 of 2 (20 of 40 items), so the All shelf has a More feed.
    ownApi.intercept({ path: /^\/api\/works\?.*page=1(&|$)/, method: 'GET' })
      .reply(200, worksResponse([work({ id: 1, title: 'One' })], 1, 20, 40)).persist();
    const requested: string[] = [];
    ownApi.intercept({ path: /^\/api\/works\?.*page=2(&|$)/, method: 'GET' }).reply(() => {
      requested.push('2');
      return { statusCode: 200, data: JSON.stringify(worksResponse([work({ id: 50, title: 'Page2' })], 2, 20, 40)) };
    }).persist();
    const local = new AsmrOneExtension(own);
    local.setSettings(settings);

    const feed = await local.loadHomeFeed();
    const shelves = await feed.getPagedData(null).then((d) => d.pagedData.loadAll());
    const all = shelves.find((s) => s.shelfKind === 'Items' && s.id === 'all');
    if (all?.shelfKind !== 'Items' || !all.more) throw new Error('expected a More feed');
    const next = await all.more.getPagedData(null).then((d) => d.pagedData.loadPage(null));
    expect(requested).toEqual(['2']);
    expect(next.data.length).toBe(1);
    expect(next.continuation).toBeNull();
    configureTranslator({ dispatcher: agent });
    await own.close();
  });
});

describe('work mapping', () => {
  it('maps a work to an album with stars, a description and the liked flag', async () => {
    api.intercept({ path: '/api/workInfo/123', method: 'GET' }).reply(200, work()).persist();
    const album = await ext.loadAlbum(makeAlbum({ id: '123', title: 'x', description: null }));
    expect(album.id).toBe('123');
    // Kotlin Work.translate moves the leading [RJ..] group to the end, even without a real translation.
    expect(album.title).toBe(' Title[RJ123]');
    expect(album.subtitle).toBe('★★★★☆');
    expect(album.description).toContain('Tags: Tag EN');
    expect(album.description).toContain('Rating: 4.0');
    expect(album.artists.map((a) => a.name)).toEqual(['VA One']);
    expect(album.extras.isLiked).toBe('true');
    expect(album.releaseDate?.epochTimeMs).toBeGreaterThan(0);
  });
});

describe('album tracks, folders and radio', () => {
  beforeEach(() => {
    api.intercept({ path: '/api/tracks/123?v=1', method: 'GET' }).reply(200, TREE).persist();
    api.intercept({ path: '/api/workInfo/123', method: 'GET' }).reply(200, work()).persist();
  });

  it('lists the tracks of the mp3 folder, sorted by title, with the folder title', async () => {
    const album = makeAlbum({ id: '123', title: 'Title' });
    const feed = await ext.loadAlbumTracks(album);
    const tracks = await feed?.getPagedData(null).then((d) => d.pagedData.loadAll()) ?? [];
    expect(tracks.map((t) => t.title)).toEqual(['a.wav', 'b.wav']);
    expect(tracks[0]?.extras.folderTitle).toBe('mp3');
    expect(tracks[0]?.streamables[0]).toMatchObject({ type: 'Server', id: 'https://cdn/s1' });
    expect(tracks[0]?.duration).toBe(3000);
  });

  it('the album feed has folder categories and a related shelf when it loads', async () => {
    api.intercept({ path: '/api/recommender/item-neighbors', method: 'POST' }).reply(200, worksResponse([work({ id: 7, title: 'Near' })])).persist();
    const feed = await ext.loadAlbumFeed(makeAlbum({ id: '123', title: 'Title' }));
    const shelves = await feed?.getPagedData(null).then((d) => d.pagedData.loadAll()) ?? [];
    expect(shelves.map((s) => s.shelfKind)).toEqual(['Category', 'Category', 'Items']);
    const related = shelves[2];
    expect(related).toMatchObject({ shelfKind: 'Items', id: 'related', title: 'Related' });
  });

  it('a radio for a track continues after it in its folder', async () => {
    const track: Track = makeTrack({
      id: 'h1',
      title: 'a.wav',
      album: makeAlbum({ id: '123', title: 'Title' }),
      extras: { folderTitle: 'mp3', untranslatedTitle: 'a.wav', id: '123', isLiked: 'false' },
    });
    const radio = await ext.radio(track);
    expect(radio).toMatchObject({ kind: 'Radio', id: 'TRACK_123', title: 'mp3', extras: { hash: 'h1' } });
    const next = await (await ext.loadRadioTracks(radio)).getPagedData(null).then((d) => d.pagedData.loadAll());
    expect(next.map((t) => t.title)).toEqual(['b.wav']);
  });

  it('a radio for a streamable of an open-album stub throws', async () => {
    await expect(ext.loadStreamableMedia(serverStreamable('OPEN_ALBUM', 1))).rejects.toThrow(
      'Open the album below to access the track',
    );
  });
});

describe('lyrics', () => {
  it('finds the .vtt by name, downloads it and returns timed lines', async () => {
    api.intercept({ path: '/api/tracks/123?v=1', method: 'GET' }).reply(200, TREE).persist();
    agent.get('https://cdn').intercept({ path: '/dl/sub.vtt', method: 'GET' }).reply(200, 'WEBVTT\n\n00:01.000 --> 00:02.000\nHi there\n').persist();
    const track = makeTrack({ id: 'h2', title: 'b.wav', album: makeAlbum({ id: '123', title: 'T' }), extras: { untranslatedTitle: 'b.wav', id: '123' } });
    const feed = await ext.searchTrackLyrics(track);
    const [lyrics] = await feed.getPagedData(null).then((d) => d.pagedData.loadAll());
    expect(lyrics?.extras.workId).toBe('123');
    if (!lyrics) throw new Error('no lyrics match');
    const loaded = await ext.loadLyrics(lyrics);
    expect(loaded.lyrics).toEqual({ kind: 'Timed', list: [{ text: 'Hi there', startTime: 1000, endTime: 2000 }], fillTimeGaps: true });
  });
});

describe('likes, playlists and login', () => {
  it('liking sends a rating of 5 and marks the album liked until it is reloaded', async () => {
    asmrOne.intercept({ path: '/api/review', method: 'PUT', body: (b) => JSON.parse(b).work_id === '123' && JSON.parse(b).rating === 5 }).reply(200, {}).persist();
    const album = makeAlbum({ id: '123', title: 'T', description: 'd' });
    await ext.likeItem(album, true);
    expect(await ext.loadAlbum(album)).toMatchObject({ extras: { isLiked: 'true' } });
  });

  it('a default playlist cannot be deleted', async () => {
    await expect(ext.deletePlaylist(makePlaylist({ id: 'p', title: 'Liked', isEditable: true }))).rejects.toThrow(
      'Cannot delete default playlist',
    );
  });

  it('editing metadata sends the nested data object and keeps privacy', async () => {
    asmrOne.intercept({
      path: '/api/playlist/edit-playlist-metadata',
      method: 'POST',
      body: (b) => {
        const body = JSON.parse(b) as { id: string; data: { name: string; privacy: number; description: string } };
        return body.id === 'p1' && body.data.name === 'New name' && body.data.privacy === 1 && body.data.description === 'x';
      },
    }).reply(200, {}).persist();
    await ext.editPlaylistMetadata(makePlaylist({ id: 'p1', title: 'Old', isEditable: true, isPrivate: false }), 'New name', 'x');
  });

  it('login stores the token and sends it as a bearer header afterwards', async () => {
    asmrOne.intercept({ path: '/api/auth/me', method: 'POST' }).reply(200, {
      user: { loggedIn: true, name: 'Me', group: 'g', email: null, recommenderUuid: 'uuid-1' },
      token: 'tok-123',
    });
    const [user] = await ext.onLogin('login', { username: 'me', password: 'pw' });
    expect(user).toMatchObject({ id: 'uuid-1', name: 'Me', extras: { token: 'tok-123' } });
    ext.setLoginUser(user ?? null);

    asmrOne.intercept({ path: /^\/api\/playlist\/get-playlists/, method: 'GET', headers: { authorization: 'Bearer tok-123' } })
      .reply(200, { playlists: [], pagination: { currentPage: 1, pageSize: 96, totalCount: 0 } });
    expect(await ext.listEditablePlaylists(null)).toEqual([]);
  });

  it('login with missing credentials returns no user without calling the network', async () => {
    expect(await ext.onLogin('login', { username: 'me' })).toEqual([]);
  });
});

describe('quick search', () => {
  it('turns typed tags into $tag tokens and suggests completions', async () => {
    tagsIntercept();
    const options = await ext.quickSearch('alpha ze');
    // Kotlin template spacing: "<used tags> <rest> <last word>" keeps the double space when rest is empty.
    expect(options[0]).toMatchObject({ kind: 'Query', searched: false, query: '$tag:Alpha$  ze' });
    expect(options[1]).toMatchObject({ kind: 'Query', query: '$tag:Alpha$  $tag:Zeta$' });
  });
});
