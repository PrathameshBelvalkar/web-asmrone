import { feedOfPaged, type Feed } from '../../../models/feed.js';
import { PagedData } from '../../../models/paged-data.js';
import { serverMedia, type StreamMedia, type Streamable } from '../../../models/echo/streamable.js';
import type { Album, Artist, Playlist, Track } from '../../../models/echo/media.js';
import type { Shelf } from '../../../models/echo/shelf.js';
import {
  findMainAudioFolder,
  getAllAudioFiles,
  getFolder,
  type FolderNode,
  type MediaNode,
} from '../media-tree/tree.js';
import { audioToTrack } from '../mappers/tracks.js';
import {
  categoryShelf,
  continuousShelfFeed,
  folderCategory,
  itemShelf,
  itemsShelf,
} from '../mappers/shelves.js';
import { workToAlbum, workToFakeTrack } from '../mappers/works.js';
import { sortByText } from '../util/text.js';
import { SLOW_SHELF_TIMEOUT_MS, shelfOrNull, withTimeoutOrNull, type ExtensionContext } from './context.js';

/** Albums, artists, playlist contents, tracks, and the stream lookup. */
export class CatalogFeature {
  constructor(private readonly ctx: ExtensionContext) {}

  /** Album details. Fetched only when the album has no description yet (as in Kotlin). */
  async loadAlbum(album: Album): Promise<Album> {
    if (album.description !== null) {
      const pending = this.ctx.pendingLikes.get(Number(album.id));
      if (pending === 'LIKE') return { ...album, extras: { ...album.extras, isLiked: 'true' } };
      if (pending === 'UNLIKE') return { ...album, extras: { ...album.extras, isLiked: 'false' } };
      return album;
    }
    return workToAlbum(await this.ctx.api.getWork(album.id), this.ctx.pendingLikes);
  }

  /** Folder shelves of the work, then the optional "Related" shelf (patch 10). */
  loadAlbumFeed(album: Album): Feed<Shelf> {
    return feedOfPaged(
      PagedData.single<Shelf>(async () => {
        const tree = await this.ctx.api.getWorkMediaTree(album.id);
        const folderShelves = tree.children.flatMap((node) => this.nodeToShelves(node, album));
        const related = await shelfOrNull(() =>
          withTimeoutOrNull(SLOW_SHELF_TIMEOUT_MS, async () => {
            const response = await this.ctx.api.getRelatedWorks(album.id);
            const albums = response.works.map((w) => workToAlbum(w, this.ctx.pendingLikes));
            return itemsShelf('related', 'Related', albums);
          }),
        );
        return related ? [...folderShelves, related] : folderShelves;
      }),
    );
  }

  /** Tracks of the work's main audio folder, sorted by title. Empty when there is none. */
  loadAlbumTracks(album: Album): Feed<Track> {
    return feedOfPaged(
      PagedData.single<Track>(async () => {
        const tree = await this.ctx.api.getWorkMediaTree(album.id);
        const path = findMainAudioFolder(tree);
        if (path === null) return [];
        const folder = getFolder(tree, path);
        return sortByText(
          getAllAudioFiles(folder, false).map((a) => audioToTrack(a, album, folder.title)),
          (t) => t.title,
        );
      }),
    );
  }

  loadArtistFeed(artist: Artist): Feed<Shelf> {
    return continuousShelfFeed(
      (page) => this.ctx.api.searchWorks(page, `$va:${artist.name}$`),
      (r) => r.works.map((w) => itemShelf(workToAlbum(w, this.ctx.pendingLikes))),
    );
  }

  loadPlaylistFeed(playlist: Playlist): Feed<Shelf> {
    return continuousShelfFeed(
      (page) => this.ctx.api.getPlaylistWorks(playlist.id, page),
      (r) => r.works.map((w) => itemShelf(workToAlbum(w, this.ctx.pendingLikes))),
    );
  }

  /** Playlist contents as placeholder tracks (page 1 only, so entries can be removed). */
  loadPlaylistTracks(playlist: Playlist): Feed<Track> {
    return feedOfPaged(
      PagedData.single<Track>(async () => {
        const response = await this.ctx.api.getPlaylistWorks(playlist.id, 1);
        return response.works.map(workToFakeTrack);
      }),
    );
  }

  loadTrack(track: Track): Promise<Track> {
    const albumId = track.album?.id;
    const pending = albumId === undefined ? undefined : this.ctx.pendingLikes.get(Number(albumId));
    if (pending === 'LIKE') return Promise.resolve({ ...track, extras: { ...track.extras, isLiked: 'true' } });
    if (pending === 'UNLIKE') return Promise.resolve({ ...track, extras: { ...track.extras, isLiked: 'false' } });
    return Promise.resolve(track);
  }

  loadStreamableMedia(streamable: Streamable): Promise<StreamMedia> {
    if (streamable.id === 'OPEN_ALBUM') {
      return Promise.reject(new Error('Open the album below to access the track'));
    }
    return Promise.resolve(serverMedia(streamable.id));
  }

  /** Folder nodes become categories, audio becomes track items, anything else is dropped. */
  private nodeToShelves(node: MediaNode, album: Album): Shelf[] {
    if (node.type === 'audio') return [itemShelf(audioToTrack(node, album, node.title))];
    if (node.type !== 'folder') return [];
    const feed = feedOfPaged(
      PagedData.single<Shelf>(() => Promise.resolve(node.children.flatMap((child) => this.nodeToShelves(child, album)))),
    );
    return [categoryShelf(folderCategory(node.untranslatedTitle, node.title, feed))];
  }
}

export type { FolderNode };
