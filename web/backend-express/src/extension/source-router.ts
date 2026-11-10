import type { Album, Artist, EchoMediaItem, Playlist, Radio, Track } from '../models/echo/media.js';
import type { Lyrics } from '../models/echo/lyrics.js';
import type { QuickSearchItem } from '../models/echo/quick-search.js';
import type { Settings, Setting } from '../models/echo/settings.js';
import type { StreamMedia, Streamable } from '../models/echo/streamable.js';
import type { Shelf } from '../models/echo/shelf.js';
import type { User } from '../models/echo/common.js';
import type { Feed } from '../models/feed.js';
import type { LoginForm, MusicExtension } from '../models/extension.js';
import type { SourceId } from '../models/source.js';
import { JASMR_PREFIX } from './jasmr/constants.js';

/**
 * Sends each call to the source that owns it. Ids from japaneseasmr.com start with `jasmr:`; every
 * other id belongs to asmr.one. Feeds that have no id (home, search, quick search) use the source the
 * caller picks with `forSource`. Playlists, login and settings belong to asmr.one only.
 */
export class SourceRouter implements MusicExtension {
  constructor(
    private readonly asmr: MusicExtension,
    private readonly jasmr: MusicExtension,
  ) {}

  /** The extension for a chosen source, for feeds that are opened by source. */
  forSource(source: SourceId): MusicExtension {
    return source === 'jasmr' ? this.jasmr : this.asmr;
  }

  private byId(id: string): MusicExtension {
    return id.startsWith(JASMR_PREFIX) ? this.jasmr : this.asmr;
  }

  get loginForms(): readonly LoginForm[] {
    return this.asmr.loginForms;
  }

  // lifecycle and settings (asmr.one)
  onInitialize(): Promise<void> {
    return this.asmr.onInitialize();
  }

  onExtensionSelected(): Promise<void> {
    return this.asmr.onExtensionSelected();
  }

  /** One settings store for both sources (Japanese ASMR reads the translation language from it). */
  setSettings(settings: Settings): void {
    this.asmr.setSettings(settings);
    this.jasmr.setSettings(settings);
  }

  async getSettingItems(): Promise<readonly Setting[]> {
    const [asmr, jasmr] = await Promise.all([
      this.asmr.getSettingItems(),
      this.jasmr.getSettingItems(),
    ]);
    return [...asmr, ...jasmr];
  }

  // feeds (asmr.one unless the caller uses forSource)
  loadHomeFeed(): Promise<Feed<Shelf>> {
    return this.asmr.loadHomeFeed();
  }

  loadLibraryFeed(): Promise<Feed<Shelf>> {
    return this.asmr.loadLibraryFeed();
  }

  loadSearchFeed(query: string): Promise<Feed<Shelf>> {
    return this.asmr.loadSearchFeed(query);
  }

  quickSearch(query: string): Promise<QuickSearchItem[]> {
    return this.asmr.quickSearch(query);
  }

  // albums, artists, playlists
  loadAlbum(album: Album): Promise<Album> {
    return this.byId(album.id).loadAlbum(album);
  }

  loadAlbumFeed(album: Album): Promise<Feed<Shelf> | null> {
    return this.byId(album.id).loadAlbumFeed(album);
  }

  loadAlbumTracks(album: Album): Promise<Feed<Track> | null> {
    return this.byId(album.id).loadAlbumTracks(album);
  }

  loadArtist(artist: Artist): Promise<Artist> {
    return this.byId(artist.id).loadArtist(artist);
  }

  loadArtistFeed(artist: Artist): Promise<Feed<Shelf>> {
    return this.byId(artist.id).loadArtistFeed(artist);
  }

  loadPlaylist(playlist: Playlist): Promise<Playlist> {
    return this.asmr.loadPlaylist(playlist);
  }

  loadPlaylistFeed(playlist: Playlist): Promise<Feed<Shelf> | null> {
    return this.asmr.loadPlaylistFeed(playlist);
  }

  loadPlaylistTracks(playlist: Playlist): Promise<Feed<Track>> {
    return this.asmr.loadPlaylistTracks(playlist);
  }

  // tracks and streams
  loadTrack(track: Track): Promise<Track> {
    return this.byId(track.id).loadTrack(track);
  }

  loadStreamableMedia(streamable: Streamable): Promise<StreamMedia> {
    return this.byId(streamable.id).loadStreamableMedia(streamable);
  }

  // lyrics
  searchTrackLyrics(track: Track): Promise<Feed<Lyrics>> {
    return this.byId(track.id).searchTrackLyrics(track);
  }

  loadLyrics(lyrics: Lyrics): Promise<Lyrics> {
    return this.byId(lyrics.id).loadLyrics(lyrics);
  }

  // radio
  radio(item: EchoMediaItem, context: EchoMediaItem | null): Promise<Radio> {
    return this.byId(item.id).radio(item, context);
  }

  loadRadio(radio: Radio): Promise<Radio> {
    return this.byId(radio.id).loadRadio(radio);
  }

  loadRadioTracks(radio: Radio): Promise<Feed<Track>> {
    return this.byId(radio.id).loadRadioTracks(radio);
  }

  // sharing and likes
  onShare(item: EchoMediaItem): Promise<string> {
    return this.byId(item.id).onShare(item);
  }

  likeItem(item: EchoMediaItem, shouldLike: boolean): Promise<void> {
    return this.byId(item.id).likeItem(item, shouldLike);
  }

  isItemLiked(item: EchoMediaItem): Promise<boolean> {
    return this.byId(item.id).isItemLiked(item);
  }

  // playlist editing: a track from japaneseasmr.com can't go into an asmr.one playlist
  listEditablePlaylists(track: Track | null): Promise<Array<readonly [Playlist, boolean]>> {
    return track
      ? this.byId(track.id).listEditablePlaylists(track)
      : this.asmr.listEditablePlaylists(track);
  }

  createPlaylist(title: string, description: string | null): Promise<Playlist> {
    return this.asmr.createPlaylist(title, description);
  }

  deletePlaylist(playlist: Playlist): Promise<void> {
    return this.asmr.deletePlaylist(playlist);
  }

  editPlaylistMetadata(
    playlist: Playlist,
    title: string,
    description: string | null,
  ): Promise<void> {
    return this.asmr.editPlaylistMetadata(playlist, title, description);
  }

  setPrivacy(playlist: Playlist, isPrivate: boolean): Promise<void> {
    return this.asmr.setPrivacy(playlist, isPrivate);
  }

  addTracksToPlaylist(
    playlist: Playlist,
    tracks: readonly Track[],
    index: number,
    added: readonly Track[],
  ): Promise<void> {
    return this.asmr.addTracksToPlaylist(playlist, tracks, index, added);
  }

  removeTracksFromPlaylist(
    playlist: Playlist,
    tracks: readonly Track[],
    indexes: readonly number[],
  ): Promise<void> {
    return this.asmr.removeTracksFromPlaylist(playlist, tracks, indexes);
  }

  // account (asmr.one)
  onLogin(key: string, data: Readonly<Record<string, string | null>>): Promise<User[]> {
    return this.asmr.onLogin(key, data);
  }

  setLoginUser(user: User | null): void {
    this.asmr.setLoginUser(user);
  }

  getCurrentUser(): Promise<User | null> {
    return this.asmr.getCurrentUser();
  }
}
