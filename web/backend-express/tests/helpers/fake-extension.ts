import { vi } from 'vitest';
import type { MusicExtension } from '../../src/models/extension.js';

/** Every port method is a vi.fn that rejects until a test stubs it. */
export type FakeExtension = {
  [K in keyof MusicExtension]: MusicExtension[K] extends (...args: infer A) => infer R
    ? ReturnType<typeof vi.fn<(...args: A) => R>>
    : MusicExtension[K];
} & Record<string, unknown>;

export function createFakeExtension(overrides: Partial<Record<keyof MusicExtension, unknown>> = {}): FakeExtension {
  const unstubbed = (name: string) => vi.fn(() => Promise.reject(new Error(`${name} not stubbed`)));
  const methods = [
    'onInitialize', 'onExtensionSelected', 'setSettings', 'getSettingItems',
    'loadHomeFeed', 'loadLibraryFeed', 'loadSearchFeed', 'quickSearch',
    'loadAlbum', 'loadAlbumFeed', 'loadAlbumTracks', 'loadArtist', 'loadArtistFeed',
    'loadPlaylist', 'loadPlaylistFeed', 'loadPlaylistTracks',
    'loadTrack', 'loadStreamableMedia', 'searchTrackLyrics', 'loadLyrics',
    'radio', 'loadRadio', 'loadRadioTracks', 'onShare', 'likeItem', 'isItemLiked',
    'listEditablePlaylists', 'createPlaylist', 'deletePlaylist', 'editPlaylistMetadata',
    'setPrivacy', 'addTracksToPlaylist', 'removeTracksFromPlaylist',
    'onLogin', 'setLoginUser', 'getCurrentUser',
  ] as const;
  const fake: Record<string, unknown> = {
    loginForms: [{ key: 'login', label: 'Login', fields: [
      { key: 'username', label: 'Username', type: 'Username', isRequired: true },
      { key: 'password', label: 'Password', type: 'Password', isRequired: true },
    ] }],
  };
  for (const name of methods) {
    fake[name] = overrides[name] ?? unstubbed(name);
  }
  // Lifecycle and settings hooks are called by the container at startup; they do nothing.
  fake.onInitialize = overrides.onInitialize ?? vi.fn(() => Promise.resolve());
  fake.onExtensionSelected = overrides.onExtensionSelected ?? vi.fn(() => Promise.resolve());
  fake.setSettings = overrides.setSettings ?? vi.fn();
  fake.setLoginUser = overrides.setLoginUser ?? vi.fn();
  // Void writes succeed by default; a test that needs a failure stubs the method itself.
  for (const name of ['likeItem', 'setPrivacy', 'addTracksToPlaylist', 'removeTracksFromPlaylist', 'deletePlaylist', 'editPlaylistMetadata'] as const) {
    fake[name] = overrides[name] ?? vi.fn(() => Promise.resolve());
  }
  return fake as FakeExtension;
}
