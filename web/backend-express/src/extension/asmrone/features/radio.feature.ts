import { feedOfPaged, type Feed } from '../../../models/feed.js';
import { PagedData } from '../../../models/paged-data.js';
import { makeRadio, type Album, type EchoMediaItem, type Radio, type Track } from '../../../models/echo/media.js';
import { NotSupportedException } from '../../../models/errors.js';
import {
  findFolderWithAudio,
  findMainAudioFolder,
  getAllAudioFiles,
  getFolder,
  type FolderNode,
} from '../media-tree/tree.js';
import { audioToTrack } from '../mappers/tracks.js';
import { workToAlbum } from '../mappers/works.js';
import { sortByText } from '../util/text.js';
import type { ExtensionContext } from './context.js';

const NO_ID_TITLE = 'Open the album below to access the track\n\n';

/** Radio stations: ids are prefixed TRACK_, ALBUM_, ARTIST_ or PLAYLIST_ (as in the Kotlin code). */
export class RadioFeature {
  constructor(private readonly ctx: ExtensionContext) {}

  radio(item: EchoMediaItem): Radio {
    switch (item.kind) {
      case 'Track':
        return this.radioForTrack(item);
      case 'Album':
        return makeRadio({ id: `ALBUM_${item.id}`, title: item.title, cover: item.cover });
      case 'Artist':
        return makeRadio({ id: `ARTIST_${item.id}`, title: item.name, cover: item.cover });
      case 'Playlist':
        return makeRadio({ id: `PLAYLIST_${item.id}`, title: item.title, cover: item.cover });
      default:
        throw new NotSupportedException('Radio not supported for this item');
    }
  }

  loadRadioTracks(radio: Radio): Feed<Track> {
    return feedOfPaged(PagedData.single<Track>(() => this.tracksFor(radio)));
  }

  private radioForTrack(track: Track): Radio {
    if (track.title === NO_ID_TITLE) {
      return makeRadio({ id: 'TRACK_NO_ID', title: 'Open the album below to access the track' });
    }
    const folderTitle = track.extras.folderTitle;
    if (folderTitle === undefined) throw new Error('Expected folderTitle in extras');
    if (!track.album) throw new Error('Track has no album');
    return makeRadio({
      id: `TRACK_${track.album.id}`,
      title: folderTitle,
      cover: track.cover,
      extras: { hash: track.id },
    });
  }

  private async tracksFor(radio: Radio): Promise<Track[]> {
    const { id } = radio;
    if (id.startsWith('TRACK_')) {
      if (id === 'TRACK_NO_ID') return [];
      return this.tracksAfterCurrent(id.slice('TRACK_'.length), radio);
    }
    if (id.startsWith('ALBUM_')) {
      const albumId = id.slice('ALBUM_'.length);
      const tree = await this.ctx.api.getWorkMediaTree(albumId);
      const album = workToAlbum(await this.ctx.api.getWork(albumId), this.ctx.pendingLikes);
      return sortByText(
        getAllAudioFiles(tree, true).map((a) => audioToTrack(a, album, album.title)),
        (t) => t.title,
      );
    }
    if (id.startsWith('ARTIST_')) {
      const works = (
        await this.ctx.api.searchWorks(1, `$va:${radio.title}$`, 'random')
      ).works;
      const first = works[0];
      if (!first) return [];
      const tree = await this.ctx.api.getWorkMediaTree(String(first.id));
      return this.randomStationTracks(tree, workToAlbum(first, this.ctx.pendingLikes));
    }
    if (id.startsWith('PLAYLIST_')) {
      const playlistId = id.slice('PLAYLIST_'.length);
      const works = (await this.ctx.api.getPlaylistWorks(playlistId, 1)).works;
      const work = works[Math.floor(Math.random() * works.length)];
      if (!work) return [];
      const tree = await this.ctx.api.getWorkMediaTree(String(work.id));
      return this.randomStationTracks(tree, workToAlbum(work, this.ctx.pendingLikes));
    }
    return [];
  }

  /** Tracks after the given one in its folder, so playback continues from the chosen track. */
  private async tracksAfterCurrent(trackWorkId: string, radio: Radio): Promise<Track[]> {
    const hash = radio.extras.hash;
    if (hash === undefined) throw new Error('Expected hash in extras');
    const tree = await this.ctx.api.getWorkMediaTree(trackWorkId);
    const album = workToAlbum(await this.ctx.api.getWork(trackWorkId), this.ctx.pendingLikes);
    const folder = findFolderWithAudio(tree, hash);
    if (!folder) throw new Error('Could not find folder with audio');
    const tracks = sortByText(
      getAllAudioFiles(folder, false).map((a) => audioToTrack(a, album, radio.title)),
      (t) => t.title,
    );
    const index = tracks.findIndex((t) => t.id === hash);
    return index === -1 ? [] : tracks.slice(index + 1);
  }

  /** Main audio folder of the work if there is one, otherwise every audio file in it. */
  private randomStationTracks(tree: FolderNode, album: Album): Track[] {
    const path = findMainAudioFolder(tree);
    const audio =
      path === null
        ? getAllAudioFiles(tree, true)
        : getAllAudioFiles(getFolder(tree, path), false);
    return sortByText(
      audio.map((a) => audioToTrack(a, album, album.title)),
      (t) => t.title,
    );
  }
}
