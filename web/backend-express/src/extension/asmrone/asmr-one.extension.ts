import type { Dispatcher } from 'undici';
import type { Feed } from '../../models/feed.js';
import type { Album, Artist, EchoMediaItem, Playlist, Radio, Track } from '../../models/echo/media.js';
import type { Lyrics } from '../../models/echo/lyrics.js';
import type { Shelf } from '../../models/echo/shelf.js';
import type { QuickSearchItem } from '../../models/echo/quick-search.js';
import type { Settings, Setting } from '../../models/echo/settings.js';
import type { StreamMedia, Streamable } from '../../models/echo/streamable.js';
import type { User } from '../../models/echo/common.js';
import type { LoginForm, MusicExtension } from '../../models/extension.js';
import { AsmrApiClient } from './api/asmr-api.client.js';
import { AccountFeature } from './features/account.feature.js';
import { CatalogFeature } from './features/catalog.feature.js';
import type { ExtensionContext } from './features/context.js';
import { HomeFeature } from './features/home.feature.js';
import { LyricsFeature } from './features/lyrics.feature.js';
import { PlaylistFeature } from './features/playlist.feature.js';
import { RadioFeature } from './features/radio.feature.js';
import { SearchSuggestions } from './features/search.feature.js';
import type { PendingLikes } from './mappers/works.js';
import { buildSettingItems } from './settings-definitions.js';
import { sortByText } from './util/text.js';

/** asmr.one implementation of the music extension port. Delegates to feature modules. */
export class AsmrOneExtension implements MusicExtension {
  private settings: Settings | null = null;
  private readonly pendingLikes: PendingLikes = new Map();
  private readonly api: AsmrApiClient;
  private readonly home: HomeFeature;
  private readonly catalog: CatalogFeature;
  private readonly radios: RadioFeature;
  private readonly lyrics: LyricsFeature;
  private readonly playlists: PlaylistFeature;
  private readonly account: AccountFeature;
  private readonly search: SearchSuggestions;

  constructor(dispatcher: Dispatcher) {
    this.api = new AsmrApiClient(dispatcher, () => this.settings);
    const ctx: ExtensionContext = {
      api: this.api,
      pendingLikes: this.pendingLikes,
      settings: () => this.settings,
    };
    this.home = new HomeFeature(ctx);
    this.catalog = new CatalogFeature(ctx);
    this.radios = new RadioFeature(ctx);
    this.lyrics = new LyricsFeature(ctx);
    this.playlists = new PlaylistFeature(ctx);
    this.account = new AccountFeature(ctx);
    this.search = new SearchSuggestions(ctx);
  }

  /** Nothing to set up: the API client is ready once settings are set. */
  onInitialize(): Promise<void> {
    return Promise.resolve();
  }

  /** Nothing to do when selected. */
  onExtensionSelected(): Promise<void> {
    return Promise.resolve();
  }

  setSettings(settings: Settings): void {
    this.settings = settings;
  }

  async getSettingItems(): Promise<readonly Setting[]> {
    const tags = await this.api.getTags();
    const names = sortByText(
      tags.map((t) => t.i18n['en-us'].name ?? t.name),
      (name) => name,
    );
    return buildSettingItems(names);
  }

  // feeds
  loadHomeFeed(): Promise<Feed<Shelf>> {
    return Promise.resolve(this.home.loadHomeFeed());
  }

  loadLibraryFeed(): Promise<Feed<Shelf>> {
    return Promise.resolve(this.home.loadLibraryFeed());
  }

  loadSearchFeed(query: string): Promise<Feed<Shelf>> {
    return Promise.resolve(this.home.loadSearchFeed(query));
  }

  quickSearch(query: string): Promise<QuickSearchItem[]> {
    return this.search.quickSearch(query);
  }

  // albums, artists, playlists
  loadAlbum(album: Album): Promise<Album> {
    return this.catalog.loadAlbum(album);
  }

  loadAlbumFeed(album: Album): Promise<Feed<Shelf> | null> {
    return Promise.resolve(this.catalog.loadAlbumFeed(album));
  }

  loadAlbumTracks(album: Album): Promise<Feed<Track> | null> {
    return Promise.resolve(this.catalog.loadAlbumTracks(album));
  }

  loadArtist(artist: Artist): Promise<Artist> {
    return Promise.resolve(artist);
  }

  loadArtistFeed(artist: Artist): Promise<Feed<Shelf>> {
    return Promise.resolve(this.catalog.loadArtistFeed(artist));
  }

  loadPlaylist(playlist: Playlist): Promise<Playlist> {
    return Promise.resolve(playlist);
  }

  loadPlaylistFeed(playlist: Playlist): Promise<Feed<Shelf> | null> {
    return Promise.resolve(this.catalog.loadPlaylistFeed(playlist));
  }

  loadPlaylistTracks(playlist: Playlist): Promise<Feed<Track>> {
    return Promise.resolve(this.catalog.loadPlaylistTracks(playlist));
  }

  // tracks and streams
  loadTrack(track: Track): Promise<Track> {
    return this.catalog.loadTrack(track);
  }

  loadStreamableMedia(streamable: Streamable): Promise<StreamMedia> {
    return this.catalog.loadStreamableMedia(streamable);
  }

  // lyrics
  searchTrackLyrics(track: Track): Promise<Feed<Lyrics>> {
    return Promise.resolve(this.lyrics.searchTrackLyrics(track));
  }

  loadLyrics(lyrics: Lyrics): Promise<Lyrics> {
    return this.lyrics.loadLyrics(lyrics);
  }

  // radio
  radio(item: EchoMediaItem): Promise<Radio> {
    return Promise.resolve(this.radios.radio(item));
  }

  loadRadio(radio: Radio): Promise<Radio> {
    return Promise.resolve(radio);
  }

  loadRadioTracks(radio: Radio): Promise<Feed<Track>> {
    return Promise.resolve(this.radios.loadRadioTracks(radio));
  }

  // sharing and likes
  onShare(item: EchoMediaItem): Promise<string> {
    return Promise.resolve(this.account.onShare(item));
  }

  likeItem(item: EchoMediaItem, shouldLike: boolean): Promise<void> {
    return this.account.likeItem(item, shouldLike);
  }

  isItemLiked(item: EchoMediaItem): Promise<boolean> {
    return Promise.resolve(this.account.isItemLiked(item));
  }

  // playlist editing
  listEditablePlaylists(track: Track | null): Promise<Array<readonly [Playlist, boolean]>> {
    return this.playlists.listEditablePlaylists(track);
  }

  createPlaylist(title: string, description: string | null): Promise<Playlist> {
    return this.playlists.createPlaylist(title, description);
  }

  deletePlaylist(playlist: Playlist): Promise<void> {
    return this.playlists.deletePlaylist(playlist);
  }

  editPlaylistMetadata(playlist: Playlist, title: string, description: string | null): Promise<void> {
    return this.playlists.editPlaylistMetadata(playlist, title, description);
  }

  setPrivacy(playlist: Playlist, isPrivate: boolean): Promise<void> {
    return this.playlists.setPrivacy(playlist, isPrivate);
  }

  addTracksToPlaylist(
    playlist: Playlist,
    _tracks: readonly Track[],
    _index: number,
    added: readonly Track[],
  ): Promise<void> {
    return this.playlists.addTracks(playlist, added);
  }

  removeTracksFromPlaylist(
    playlist: Playlist,
    tracks: readonly Track[],
    indexes: readonly number[],
  ): Promise<void> {
    return this.playlists.removeTracks(playlist, tracks, indexes);
  }

  // account
  get loginForms(): readonly LoginForm[] {
    return this.account.loginForms;
  }

  onLogin(key: string, data: Readonly<Record<string, string | null>>): Promise<User[]> {
    return this.account.onLogin(key, data);
  }

  setLoginUser(user: User | null): void {
    this.account.setLoginUser(user);
  }

  getCurrentUser(): Promise<User | null> {
    return Promise.resolve(this.account.getCurrentUser());
  }
}
