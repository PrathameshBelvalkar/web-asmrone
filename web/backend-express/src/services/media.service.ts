import type { MusicExtension } from '../models/extension.js';
import { serversOf, type Album, type Artist, type EchoMediaItem, type Playlist, type Radio, type Track } from '../models/echo/media.js';
import type { Lyrics } from '../models/echo/lyrics.js';
import type { StreamMedia } from '../models/echo/streamable.js';
import type { OpenedFeed } from '../models/presentation.js';
import { HttpError } from '../models/errors.js';
import type { FeedService } from './feed.service.js';

/** Albums, artists, playlists, tracks, lyrics, radio, sharing and likes. */
export class MediaService {
  constructor(
    private readonly ext: MusicExtension,
    private readonly feeds: FeedService,
  ) {}

  loadAlbum(album: Album): Promise<Album> {
    return this.ext.loadAlbum(album);
  }

  /** Null means the extension had no feed for the album (the client shows an empty feed). */
  async albumFeed(album: Album): Promise<OpenedFeed | null> {
    const feed = await this.ext.loadAlbumFeed(album);
    return feed ? this.feeds.openNew(feed) : null;
  }

  async albumTracks(album: Album): Promise<OpenedFeed | null> {
    const feed = await this.ext.loadAlbumTracks(album);
    return feed ? this.feeds.openNew(feed) : null;
  }

  loadArtist(artist: Artist): Promise<Artist> {
    return this.ext.loadArtist(artist);
  }

  async artistFeed(artist: Artist): Promise<OpenedFeed> {
    return this.feeds.openNew(await this.ext.loadArtistFeed(artist));
  }

  loadPlaylist(playlist: Playlist): Promise<Playlist> {
    return this.ext.loadPlaylist(playlist);
  }

  async playlistFeed(playlist: Playlist): Promise<OpenedFeed | null> {
    const feed = await this.ext.loadPlaylistFeed(playlist);
    return feed ? this.feeds.openNew(feed) : null;
  }

  async playlistTracks(playlist: Playlist): Promise<OpenedFeed> {
    return this.feeds.openNew(await this.ext.loadPlaylistTracks(playlist));
  }

  loadTrack(track: Track): Promise<Track> {
    return this.ext.loadTrack(track);
  }

  /** Stream for the track's first server. */
  async trackMedia(track: Track): Promise<StreamMedia> {
    const server = serversOf(track)[0];
    if (!server) throw HttpError.badRequest('This track has no stream');
    return this.ext.loadStreamableMedia(server);
  }

  /** First lyrics match for the track, loaded in full. Null when there is none. */
  async lyrics(track: Track): Promise<Lyrics | null> {
    const feed = await this.ext.searchTrackLyrics(track);
    const first = (await (await feed.getPagedData(feed.notSortTabs[0] ?? null)).pagedData.loadPage(null)).data[0];
    if (first === undefined) return null;
    return this.ext.loadLyrics(first);
  }

  /** Creates a radio for the item and opens its tracks. */
  async radio(item: EchoMediaItem, context: EchoMediaItem | null): Promise<{ radio: Radio; feed: OpenedFeed }> {
    const created = await this.ext.radio(item, context);
    const loaded = await this.ext.loadRadio(created);
    const feed = await this.feeds.openNew(await this.ext.loadRadioTracks(loaded));
    return { radio: loaded, feed };
  }

  share(item: EchoMediaItem): Promise<string> {
    return this.ext.onShare(item);
  }

  like(item: EchoMediaItem, shouldLike: boolean): Promise<void> {
    return this.ext.likeItem(item, shouldLike);
  }

  likeStatus(item: EchoMediaItem): Promise<boolean> {
    return this.ext.isItemLiked(item);
  }
}
