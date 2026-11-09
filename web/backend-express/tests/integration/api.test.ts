import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAlbum, makePlaylist, makeTrack } from '../../src/models/echo/media.js';
import { Feed, feedOfPaged } from '../../src/models/feed.js';
import { PagedData } from '../../src/models/paged-data.js';
import { ClientException, LoginRequiredException, NotSupportedException, UnauthorizedException } from '../../src/models/errors.js';
import type { Shelf } from '../../src/models/echo/shelf.js';
import { createFakeExtension, type FakeExtension } from '../helpers/fake-extension.js';
import { makeTestApp, type TestApp } from '../helpers/app.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MODEL = 'dev.brahmkshatriya.echo.common.models.';
const album = { mediaItemType: `${MODEL}Album`, id: '1', title: 'Album', extras: {} };
const track = { mediaItemType: `${MODEL}Track`, id: 'h1', title: 'Track', extras: {} };
const playlist = { mediaItemType: `${MODEL}Playlist`, id: 'p1', title: 'Mine', isEditable: true, extras: {} };

let t: TestApp | undefined;

function current(): TestApp {
  if (!t) throw new Error('app not started');
  return t;
}
const app = () => current().app;
const readUser = () => current().readUserFile();
const dataDirOf = () => current().dataDir;
let ext: FakeExtension;

async function boot(overrides: Parameters<typeof createFakeExtension>[0] = {}): Promise<void> {
  if (t) await t.cleanup();
  ext = createFakeExtension(overrides);
  t = await makeTestApp({ extension: ext });
}

beforeEach(async () => {
  await boot();
});

afterEach(async () => {
  await t?.cleanup();
  t = undefined;
});

describe('feeds', () => {
  it('opens the home feed and pages it', async () => {
    const shelves: Shelf[] = [
      { shelfKind: 'Items', id: 'all', title: 'All', list: [makeAlbum({ id: '1', title: 'A' })], subtitle: null, layout: 'Linear', more: null, extras: {} },
    ];
    await boot({ loadHomeFeed: vi.fn(() => Promise.resolve(feedOfPaged(PagedData.single(() => Promise.resolve(shelves))))) });

    const feed = await request(app()).get('/api/home').expect(200);
    expect(feed.body.feedId).toEqual(expect.any(String));
    expect(feed.body.pagedId).toEqual(expect.any(String));
    expect(feed.body.showSearch).toBe(true);

    const page = await request(app()).get(`/api/pages/${feed.body.pagedId as string}`).expect(200);
    expect(page.body.items[0].kind).toBe('items');
    expect(page.body.items[0].items[0].mediaItemType).toBe(`${MODEL}Album`);
    expect(page.body.continuation).toBeNull();
  });

  it('reopens a feed by id at a tab', async () => {
    const tabs = [
      { id: 'a', title: 'A', isSort: false, extras: {} },
      { id: 's', title: 'Sort', isSort: true, extras: {} },
      { id: 'b', title: 'B', isSort: false, extras: {} },
    ];
    const tabbed = new Feed(tabs, (tab) =>
      Promise.resolve({ pagedData: PagedData.single(() => Promise.resolve([])), buttons: null, background: null, selected: tab?.id }),
    );
    await boot({ loadLibraryFeed: vi.fn(() => Promise.resolve(tabbed)) });

    const opened = await request(app()).get('/api/library').expect(200);
    expect(opened.body.tabs.map((x: { id: string }) => x.id)).toEqual(['a', 'b']); // sort tabs hidden
    expect(opened.body.selectedTab).toBe('a');

    const again = await request(app()).get(`/api/feeds/${opened.body.feedId as string}/open?tab=b`).expect(200);
    expect(again.body.selectedTab).toBe('b');
    expect(again.body.pagedId).not.toBe(opened.body.pagedId);
  });

  it('returns 410 expired for an unknown feed or page id', async () => {
    const feed = await request(app()).get('/api/feeds/nope/open').expect(410);
    expect(feed.body).toEqual({ type: 'expired', message: 'This list expired. Reopen it.' });
    await request(app()).get('/api/pages/nope').expect(410);
  });

  it('pages with a continuation token and passes it through', async () => {
    const load = vi.fn((cont: string | null) =>
      Promise.resolve({ data: [makeAlbum({ id: cont ?? 'first', title: 'T' })], continuation: cont === null ? 'next' : null }),
    );
    await boot({ loadSearchFeed: vi.fn(() => Promise.resolve(feedOfPaged(PagedData.continuous(load)))) });
    const opened = await request(app()).get('/api/search?q=abc').expect(200);
    expect(ext.loadSearchFeed).toHaveBeenCalledWith('abc');
    const first = await request(app()).get(`/api/pages/${opened.body.pagedId as string}`).expect(200);
    expect(first.body.continuation).toBe('next');
    const second = await request(app()).get(`/api/pages/${opened.body.pagedId as string}?cont=next`).expect(200);
    expect(second.body.continuation).toBeNull();
  });

  it('quicksearch returns [] for a blank query without calling the extension', async () => {
    await request(app()).get('/api/quicksearch?q=%20').expect(200, []);
    expect(ext.quickSearch).not.toHaveBeenCalled();
  });

  it('quicksearch returns the suggestions', async () => {
    ext.quickSearch.mockResolvedValueOnce([{ kind: 'Query', query: 'asmr', searched: false, extras: {} }]);
    const res = await request(app()).get('/api/quicksearch?q=asmr').expect(200);
    expect(res.body).toEqual([{ quickSearchItemType: `${MODEL}QuickSearchItem.Query`, query: 'asmr', searched: false, extras: {} }]);
  });
});

describe('media endpoints', () => {
  it('album load returns the album as a top-level media item', async () => {
    ext.loadAlbum.mockImplementationOnce((a) => Promise.resolve(makeAlbum({ id: a.id, title: 'Loaded', description: 'd' })));
    const res = await request(app()).post('/api/album/load').send({ item: album }).expect(200);
    expect(res.body.mediaItemType).toBe(`${MODEL}Album`);
    expect(res.body.title).toBe('Loaded');
    expect(res.body.description).toBe('d');
  });

  it('album feed returns the empty feed when the extension has none', async () => {
    ext.loadAlbumFeed.mockResolvedValueOnce(null);
    const res = await request(app()).post('/api/album/feed').send({ item: album }).expect(200);
    expect(res.body).toMatchObject({ feedId: null, pagedId: null, tabs: [], showSearch: true, showPlayAndShuffle: false });
  });

  it('rejects an item of the wrong kind with "Expected Album"', async () => {
    const res = await request(app()).post('/api/album/load').send({ item: track }).expect(400);
    expect(res.body).toEqual({ type: 'bad_request', message: 'Expected Album' });
  });

  it('rejects a missing item with "Missing media item"', async () => {
    const res = await request(app()).post('/api/album/load').send({}).expect(400);
    expect(res.body.message).toBe('Missing media item');
  });

  it('track media needs a server stream and registers the stream URL', async () => {
    const noStream = await request(app()).post('/api/track/media').send({ item: track }).expect(400);
    expect(noStream.body).toEqual({ type: 'bad_request', message: 'This track has no stream' });

    ext.loadStreamableMedia.mockResolvedValueOnce({ mediaKind: 'Server', sources: [{ sourceKind: 'Http', request: { url: 'https://cdn/x.mp3', headers: {}, method: 'GET', bodyBase64: null }, type: 'Progressive', decryption: null, quality: 0, title: null, isVideo: false, isLive: false }], merged: false });
    const withStream = { ...track, streamables: [{ id: 'https://cdn/x.mp3', quality: 1, type: 'Server', title: null, extras: {} }] };
    const res = await request(app()).post('/api/track/media').send({ item: withStream }).expect(200);
    expect(res.body.mediaType).toBe(`${MODEL}Streamable.Media.Server`);
    expect(res.body.sources[0].sourceType).toBe(`${MODEL}Streamable.Source.Http`);
  });

  it('lyrics returns null when no lyrics match', async () => {
    ext.searchTrackLyrics.mockResolvedValueOnce(feedOfPaged(PagedData.single(() => Promise.resolve([]))));
    const res = await request(app()).post('/api/lyrics').send({ item: track }).expect(200).expect('Content-Type', /json/);
    expect(res.text).toBe('null');
  });

  it('radio returns the radio and its tracks', async () => {
    ext.radio.mockResolvedValueOnce({ kind: 'Radio', id: 'ALBUM_1', title: 'R', cover: null, authors: [], trackCount: null, description: null, subtitle: null, extras: {}, isFollowable: false, isSaveable: false, isLikeable: false, isHideable: false, isShareable: true });
    ext.loadRadio.mockImplementationOnce((r) => Promise.resolve(r));
    ext.loadRadioTracks.mockResolvedValueOnce(feedOfPaged(PagedData.single(() => Promise.resolve([makeTrack({ id: 't', title: 'T' })]))));
    const res = await request(app()).post('/api/radio').send({ item: album }).expect(200);
    expect(res.body.radio.id).toBe('ALBUM_1');
    expect(res.body.feed.pagedId).toEqual(expect.any(String));
    expect(ext.radio).toHaveBeenCalledWith(expect.objectContaining({ kind: 'Album' }), null);
  });

  it('share returns the url', async () => {
    ext.onShare.mockResolvedValueOnce('https://asmr.one/work/RJ1');
    await request(app()).post('/api/share').send({ item: album }).expect(200, { url: 'https://asmr.one/work/RJ1' });
  });

  it('like defaults shouldLike to true and returns 204', async () => {
    await request(app()).post('/api/like').send({ item: album }).expect(204);
    expect(ext.likeItem).toHaveBeenCalledWith(expect.objectContaining({ kind: 'Album' }), true);
    await request(app()).post('/api/like').send({ item: album, shouldLike: false }).expect(204);
    expect(ext.likeItem).toHaveBeenLastCalledWith(expect.anything(), false);
  });

  it('like status returns liked', async () => {
    ext.isItemLiked.mockResolvedValueOnce(true);
    await request(app()).post('/api/like/status').send({ item: album }).expect(200, { liked: true });
  });

  it('artist load returns the artist; the artist feed opens its shelves', async () => {
    const artist = { mediaItemType: `${MODEL}Artist`, id: 'a', name: 'Voice', extras: {} };
    ext.loadArtist.mockImplementationOnce((a) => Promise.resolve(a));
    const res = await request(app()).post('/api/artist/load').send({ item: artist }).expect(200);
    expect(res.body).toMatchObject({ mediaItemType: `${MODEL}Artist`, name: 'Voice' });
    ext.loadArtistFeed.mockResolvedValueOnce(feedOfPaged(PagedData.single(() => Promise.resolve([]))));
    await request(app()).post('/api/artist/feed').send({ item: artist }).expect(200);
  });
});

describe('playlists', () => {
  it('create needs a title', async () => {
    const res = await request(app()).post('/api/playlists/create').send({}).expect(400);
    expect(res.body.message).toBe('title is required');
    ext.createPlaylist.mockImplementationOnce((title) => Promise.resolve(makePlaylist({ id: 'new', title, isEditable: true })));
    const ok = await request(app()).post('/api/playlists/create').send({ title: 'New' }).expect(200);
    expect(ok.body.title).toBe('New');
    expect(ext.createPlaylist).toHaveBeenCalledWith('New', null);
  });

  it('privacy defaults isPrivate to true', async () => {
    await request(app()).post('/api/playlists/privacy').send({ item: playlist }).expect(204);
    expect(ext.setPrivacy).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), true);
  });

  it('add-tracks defaults the index to the existing track count', async () => {
    const existing = [track, { ...track, id: 'h2' }];
    await request(app()).post('/api/playlists/add-tracks').send({ item: playlist, tracks: existing, new: [track] }).expect(204);
    expect(ext.addTracksToPlaylist).toHaveBeenCalledWith(expect.anything(), expect.any(Array), 2, expect.any(Array));
  });

  it('remove-tracks maps non-integer indexes to 0', async () => {
    await request(app()).post('/api/playlists/remove-tracks').send({ item: playlist, tracks: [track], indexes: ['x', 0] }).expect(204);
    expect(ext.removeTracksFromPlaylist).toHaveBeenCalledWith(expect.anything(), expect.any(Array), [0, 0]);
  });

  it('track lists must contain tracks', async () => {
    const res = await request(app()).post('/api/playlists/add-tracks').send({ item: playlist, new: [album] }).expect(400);
    expect(res.body.message).toBe('Expected track in new');
  });

  it('editable lists the playlists and whether they hold the track', async () => {
    ext.listEditablePlaylists.mockResolvedValueOnce([[makePlaylist({ id: 'p', title: 'P', isEditable: true }), true]]);
    const res = await request(app()).post('/api/playlists/editable').send({ track }).expect(200);
    expect(res.body).toEqual([expect.objectContaining({ contains: true, playlist: expect.objectContaining({ id: 'p' }) })]);
  });
});

describe('account', () => {
  it('forms come from the extension', async () => {
    const res = await request(app()).get('/api/auth/forms').expect(200);
    expect(res.body[0]).toMatchObject({ key: 'login', fields: [{ key: 'username', type: 'Username', required: true }, { key: 'password', type: 'Password', required: true }] });
  });

  it('login saves the user, sets it on the extension, and returns it', async () => {
    ext.onLogin.mockResolvedValueOnce([{ id: 'u1', name: 'Name', cover: null, subtitle: null, extras: { token: 'tok' } }]);
    const res = await request(app()).post('/api/auth/login').send({ data: { username: 'me', password: 'pw' } }).expect(200);
    expect(res.body).toEqual({ id: 'u1', name: 'Name', cover: null, subtitle: null, extras: { token: 'tok' } });
    expect(ext.onLogin).toHaveBeenCalledWith('login', { username: 'me', password: 'pw' });
    expect(ext.setLoginUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }));
    expect(JSON.parse((await readUser()) ?? 'null')).toMatchObject({ id: 'u1' });
  });

  it('login with no user is a 400', async () => {
    ext.onLogin.mockResolvedValueOnce([]);
    const res = await request(app()).post('/api/auth/login').send({ data: {} }).expect(400);
    expect(res.body).toEqual({ type: 'bad_request', message: 'Login returned no user' });
  });

  it('me returns the user or null, and logout clears the saved login', async () => {
    ext.getCurrentUser.mockResolvedValueOnce(null);
    const res = await request(app()).get('/api/auth/me').expect(200).expect('Content-Type', /json/);
    expect(res.text).toBe('null');
    ext.onLogin.mockResolvedValueOnce([{ id: 'u1', name: 'N', cover: null, subtitle: null, extras: {} }]);
    await request(app()).post('/api/auth/login').send({ data: { username: 'a', password: 'b' } }).expect(200);
    await request(app()).post('/api/auth/logout').expect(204);
    expect(await readUser()).toBeNull();
    expect(ext.setLoginUser).toHaveBeenLastCalledWith(null);
  });

  it('an expired session returns 401 unauthorized and forgets the saved login', async () => {
    ext.onLogin.mockResolvedValueOnce([{ id: 'u1', name: 'N', cover: null, subtitle: null, extras: {} }]);
    await request(app()).post('/api/auth/login').send({ data: { username: 'a', password: 'b' } }).expect(200);
    ext.getCurrentUser.mockRejectedValueOnce(new UnauthorizedException('u1'));
    const res = await request(app()).get('/api/auth/me').expect(401);
    expect(res.body).toEqual({ type: 'unauthorized', message: 'u1' });
    expect(await readUser()).toBeNull();
    expect(ext.setLoginUser).toHaveBeenLastCalledWith(null);
  });
});

describe('error envelopes', () => {
  it('maps extension errors to their wire types', async () => {
    ext.loadAlbumTracks.mockRejectedValueOnce(new LoginRequiredException());
    await request(app()).post('/api/album/tracks').send({ item: album }).expect(401, { type: 'login_required', message: null });

    ext.loadAlbumTracks.mockRejectedValueOnce(new NotSupportedException('Move track'));
    await request(app()).post('/api/album/tracks').send({ item: album }).expect(501, { type: 'not_supported', message: 'Move track' });

    ext.loadAlbumTracks.mockRejectedValueOnce(new ClientException('bad'));
    await request(app()).post('/api/album/tracks').send({ item: album }).expect(500, { type: 'other', message: 'bad' });

    ext.loadAlbumTracks.mockRejectedValueOnce(new Error(''));
    await request(app()).post('/api/album/tracks').send({ item: album }).expect(500, { type: 'other', message: 'Error' });
  });

  it('unknown /api routes return JSON 404 for any method', async () => {
    await request(app()).get('/api/nothing').expect(404, { type: 'not_found', message: null });
    await request(app()).post('/api/nothing').expect(404, { type: 'not_found', message: null });
  });

  it('a known path with the wrong method returns 405 with an Allow header', async () => {
    const del = await request(app()).delete('/api/home').expect(405);
    expect(del.headers.allow).toBe('GET');
    expect(del.body).toEqual({ type: 'method_not_allowed', message: null });
    const put = await request(app()).put('/api/auth/me').expect(405);
    expect(put.headers.allow).toBe('GET');
    const get = await request(app()).get('/api/settings/onlyShowSfw').expect(405);
    expect(get.headers.allow).toBe('PUT');
  });

  it('HEAD is answered by the GET routes', async () => {
    await request(app()).head('/api/auth/forms').expect(200);
  });

  it('a body that is not a JSON object is a 400', async () => {
    const bad = await request(app()).post('/api/share').set('Content-Type', 'application/json').send('[1]').expect(400);
    expect(bad.body).toEqual({ type: 'bad_request', message: 'Body must be a JSON object' });
    const broken = await request(app()).post('/api/share').set('Content-Type', 'application/json').send('{oops').expect(400);
    expect(broken.body.message).toBe('Body must be a JSON object');
  });
});

describe('settings', () => {
  it('lists settings with stored values resolved over defaults', async () => {
    ext.getSettingItems.mockResolvedValueOnce([
      { kind: 'Switch', key: 'onlyShowSfw', title: 'SFW', defaultValue: false },
      { kind: 'List', key: 'siteMirror', title: 'Mirror', entryTitles: ['a', 'b'], entryValues: ['a', 'b'], defaultEntryIndex: 0 },
    ]);
    const before = await request(app()).get('/api/settings').expect(200);
    expect(before.body[0]).toMatchObject({ kind: 'switch', value: false });
    expect(before.body[1]).toMatchObject({ kind: 'list', value: 'a', options: [{ title: 'a', value: 'a' }, { title: 'b', value: 'b' }] });

    await request(app()).put('/api/settings/onlyShowSfw').send({ value: true }).expect(204);
    expect(ext.setSettings).toHaveBeenCalled();
    ext.getSettingItems.mockResolvedValueOnce([{ kind: 'Switch', key: 'onlyShowSfw', title: 'SFW', defaultValue: false }]);
    const after = await request(app()).get('/api/settings').expect(200);
    expect(after.body[0].value).toBe(true);
  });

  it('a null value removes the stored setting', async () => {
    await request(app()).put('/api/settings/k').send({ value: 'x' }).expect(204);
    await request(app()).put('/api/settings/k').send({ value: null }).expect(204);
    const stored = JSON.parse(await readFile(join(dataDirOf(), 'settings.json'), 'utf8')) as Record<string, unknown>;
    expect(stored).not.toHaveProperty('k');
  });
});
