import type { Playlist, Track } from '../../../models/echo/media.js';
import type { ExtensionContext } from './context.js';
import { asmrPlaylistToPlaylist } from '../mappers/works.js';

const DEFAULT_PLAYLISTS = ['Marked', 'Liked'] as const;

/** Playlist editing. Default playlists ("Marked", "Liked") keep their names and cannot be deleted. */
export class PlaylistFeature {
  constructor(private readonly ctx: ExtensionContext) {}

  /** Each playlist paired with whether it already holds the track (page 1 of each playlist). */
  async listEditablePlaylists(track: Track | null): Promise<Array<readonly [Playlist, boolean]>> {
    const response = await this.ctx.api.getPlaylists();
    const playlists = response.playlists.map(asmrPlaylistToPlaylist);
    const workId = track?.extras.id;
    return Promise.all(
      playlists.map(async (playlist) => {
        const works = (await this.ctx.api.getPlaylistWorks(playlist.id, 1)).works;
        const inPlaylist = works.some((w) => String(w.id) === workId);
        return [playlist, inPlaylist] as const;
      }),
    );
  }

  async createPlaylist(title: string, description: string | null): Promise<Playlist> {
    return asmrPlaylistToPlaylist(await this.ctx.api.createPlaylist(title, description ?? ''));
  }

  async deletePlaylist(playlist: Playlist): Promise<void> {
    if (isDefault(playlist)) throw new Error('Cannot delete default playlist');
    await this.ctx.api.deletePlaylist(playlist.id);
  }

  async editPlaylistMetadata(playlist: Playlist, title: string, description: string | null): Promise<void> {
    const newTitle = isDefault(playlist) ? playlist.title : title;
    await this.ctx.api.editPlaylist(playlist.id, newTitle, description ?? '', playlist.isPrivate ? 0 : 1);
  }

  async setPrivacy(playlist: Playlist, isPrivate: boolean): Promise<void> {
    await this.ctx.api.editPlaylist(playlist.id, playlist.title, playlist.description ?? '', isPrivate ? 0 : 1);
  }

  async addTracks(playlist: Playlist, added: readonly Track[]): Promise<void> {
    const ids = unique(added.map(albumIdOf));
    await this.ctx.api.addWorksToPlaylist(playlist.id, ids);
  }

  async removeTracks(playlist: Playlist, tracks: readonly Track[], indexes: readonly number[]): Promise<void> {
    const ids = tracks.map(albumIdOf);
    const toRemove = indexes.map((i) => {
      const id = ids[i];
      if (id === undefined) throw new RangeError(`Index ${i} out of bounds`);
      return id;
    });
    await this.ctx.api.removeWorksFromPlaylist(playlist.id, unique(toRemove));
  }
}

function isDefault(playlist: Playlist): boolean {
  return (DEFAULT_PLAYLISTS as readonly string[]).includes(playlist.title);
}

function albumIdOf(track: Track): string {
  const id = track.album?.id ?? track.extras.id;
  if (id === undefined) throw new Error('Expected album id');
  return id;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
