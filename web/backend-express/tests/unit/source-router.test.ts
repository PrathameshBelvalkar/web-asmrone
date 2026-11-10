import { describe, expect, it } from 'vitest';
import { SourceRouter } from '../../src/extension/source-router.js';
import { makeAlbum, makeTrack } from '../../src/models/echo/media.js';
import { createFakeExtension } from '../helpers/fake-extension.js';

/** Stubs are not set up here; only the routing is under test, so a rejected call is fine. */
const called = (p: Promise<unknown>) => p.catch(() => undefined);

const album = (id: string) => makeAlbum({ id, title: 't' });
const track = (id: string) => makeTrack({ id, title: 't' });

describe('SourceRouter', () => {
  it('sends ids with the jasmr prefix to japaneseasmr and every other id to asmr.one', async () => {
    const asmr = createFakeExtension();
    const jasmr = createFakeExtension();
    const router = new SourceRouter(asmr, jasmr);

    await called(router.loadAlbum(album('jasmr:151994')));
    await called(router.loadAlbum(album('1234')));
    expect(jasmr.loadAlbum).toHaveBeenCalledTimes(1);
    expect(asmr.loadAlbum).toHaveBeenCalledTimes(1);
  });

  it('routes chapter tracks and their streams by id prefix', async () => {
    const asmr = createFakeExtension();
    const jasmr = createFakeExtension();
    const router = new SourceRouter(asmr, jasmr);

    await called(router.loadTrack(track('jasmr:151994#3')));
    await called(router.loadStreamableMedia({ id: 'jasmr:m3u8:abc', quality: 0, type: 'Server', title: null, extras: {} }));
    expect(jasmr.loadTrack).toHaveBeenCalledTimes(1);
    expect(jasmr.loadStreamableMedia).toHaveBeenCalledTimes(1);
    expect(asmr.loadTrack).not.toHaveBeenCalled();
  });

  it('opens home, search and quick search from the source the caller picks', async () => {
    const asmr = createFakeExtension();
    const jasmr = createFakeExtension();
    const router = new SourceRouter(asmr, jasmr);

    expect(router.forSource('jasmr')).toBe(jasmr);
    expect(router.forSource('asmrone')).toBe(asmr);
    await called(router.forSource('jasmr').loadHomeFeed());
    expect(jasmr.loadHomeFeed).toHaveBeenCalledTimes(1);
    expect(asmr.loadHomeFeed).not.toHaveBeenCalled();
  });

  it('keeps playlists and login with asmr.one, even for jasmr items', async () => {
    const asmr = createFakeExtension();
    const jasmr = createFakeExtension();
    const router = new SourceRouter(asmr, jasmr);

    await called(router.listEditablePlaylists(track('jasmr:151994#0')));
    await called(router.listEditablePlaylists(null));
    expect(jasmr.listEditablePlaylists).toHaveBeenCalledTimes(1);
    expect(asmr.listEditablePlaylists).toHaveBeenCalledTimes(1);
    expect(router.loginForms).toBe(asmr.loginForms);
    await called(router.getCurrentUser());
    expect(asmr.getCurrentUser).toHaveBeenCalledTimes(1);
  });
});
