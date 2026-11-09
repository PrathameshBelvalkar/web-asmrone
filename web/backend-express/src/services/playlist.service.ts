import type { MusicExtension } from '../models/extension.js';
import type { Playlist, Track } from '../models/echo/media.js';

/** Playlist editing. Rules (default playlists, album ids) live in the extension. */
export class PlaylistService {
  constructor(private readonly ext: MusicExtension) {}

  editable(track: Track | null): Promise<Array<readonly [Playlist, boolean]>> {
    return this.ext.listEditablePlaylists(track);
  }

  create(title: string, description: string | null): Promise<Playlist> {
    return this.ext.createPlaylist(title, description);
  }

  delete(playlist: Playlist): Promise<void> {
    return this.ext.deletePlaylist(playlist);
  }

  edit(playlist: Playlist, title: string, description: string | null): Promise<void> {
    return this.ext.editPlaylistMetadata(playlist, title, description);
  }

  privacy(playlist: Playlist, isPrivate: boolean): Promise<void> {
    return this.ext.setPrivacy(playlist, isPrivate);
  }

  addTracks(playlist: Playlist, tracks: readonly Track[], index: number, added: readonly Track[]): Promise<void> {
    return this.ext.addTracksToPlaylist(playlist, tracks, index, added);
  }

  removeTracks(playlist: Playlist, tracks: readonly Track[], indexes: readonly number[]): Promise<void> {
    return this.ext.removeTracksFromPlaylist(playlist, tracks, indexes);
  }
}
