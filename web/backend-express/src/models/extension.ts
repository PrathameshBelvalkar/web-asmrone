/**
 * Port: the music extension as the application uses it. Services depend on this interface only.
 * The asmr.one implementation lives in src/extension/asmrone.
 */
import type { Feed } from './feed.js';
import type { Album, Artist, EchoMediaItem, Playlist, Radio, Track } from './echo/media.js';
import type { Lyrics } from './echo/lyrics.js';
import type { Shelf } from './echo/shelf.js';
import type { QuickSearchItem } from './echo/quick-search.js';
import type { Settings, Setting } from './echo/settings.js';
import type { StreamMedia, Streamable } from './echo/streamable.js';
import type { User } from './echo/common.js';

export type LoginFieldType = 'Email' | 'Username' | 'Password' | 'Number' | 'Url' | 'Misc';

export interface LoginFormField {
  readonly key: string;
  readonly label: string;
  readonly type: LoginFieldType;
  readonly isRequired: boolean;
}

export interface LoginForm {
  readonly key: string;
  readonly label: string;
  readonly fields: readonly LoginFormField[];
}

export interface MusicExtension {
  // lifecycle and settings
  onInitialize(): Promise<void>;
  onExtensionSelected(): Promise<void>;
  setSettings(settings: Settings): void;
  getSettingItems(): Promise<readonly Setting[]>;

  // feeds
  loadHomeFeed(): Promise<Feed<Shelf>>;
  loadLibraryFeed(): Promise<Feed<Shelf>>;
  loadSearchFeed(query: string): Promise<Feed<Shelf>>;
  quickSearch(query: string): Promise<QuickSearchItem[]>;

  // albums, artists, playlists
  loadAlbum(album: Album): Promise<Album>;
  loadAlbumFeed(album: Album): Promise<Feed<Shelf> | null>;
  loadAlbumTracks(album: Album): Promise<Feed<Track> | null>;
  loadArtist(artist: Artist): Promise<Artist>;
  loadArtistFeed(artist: Artist): Promise<Feed<Shelf>>;
  loadPlaylist(playlist: Playlist): Promise<Playlist>;
  loadPlaylistFeed(playlist: Playlist): Promise<Feed<Shelf> | null>;
  loadPlaylistTracks(playlist: Playlist): Promise<Feed<Track>>;

  // tracks and streams
  loadTrack(track: Track): Promise<Track>;
  loadStreamableMedia(streamable: Streamable): Promise<StreamMedia>;

  // lyrics
  searchTrackLyrics(track: Track): Promise<Feed<Lyrics>>;
  loadLyrics(lyrics: Lyrics): Promise<Lyrics>;

  // radio
  radio(item: EchoMediaItem, context: EchoMediaItem | null): Promise<Radio>;
  loadRadio(radio: Radio): Promise<Radio>;
  loadRadioTracks(radio: Radio): Promise<Feed<Track>>;

  // sharing and likes
  onShare(item: EchoMediaItem): Promise<string>;
  likeItem(item: EchoMediaItem, shouldLike: boolean): Promise<void>;
  isItemLiked(item: EchoMediaItem): Promise<boolean>;

  // playlist editing
  listEditablePlaylists(track: Track | null): Promise<Array<readonly [Playlist, boolean]>>;
  createPlaylist(title: string, description: string | null): Promise<Playlist>;
  deletePlaylist(playlist: Playlist): Promise<void>;
  editPlaylistMetadata(playlist: Playlist, title: string, description: string | null): Promise<void>;
  setPrivacy(playlist: Playlist, isPrivate: boolean): Promise<void>;
  addTracksToPlaylist(playlist: Playlist, tracks: readonly Track[], index: number, added: readonly Track[]): Promise<void>;
  removeTracksFromPlaylist(playlist: Playlist, tracks: readonly Track[], indexes: readonly number[]): Promise<void>;

  // account
  readonly loginForms: readonly LoginForm[];
  onLogin(key: string, data: Readonly<Record<string, string | null>>): Promise<User[]>;
  setLoginUser(user: User | null): void;
  getCurrentUser(): Promise<User | null>;
}
