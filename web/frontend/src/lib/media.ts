import type { Album, Artist, ImageHolder, MediaItem, Playlist, Track, Kind } from '../api/types';
import { MODEL_PREFIX } from '../api/types';

export function kindOf(item: { mediaItemType: string }): Kind {
  return item.mediaItemType.slice(MODEL_PREFIX.length) as Kind;
}

export function titleOf(item: { title?: string; name?: string }): string {
  return item.title || item.name || '';
}

export function artistsOf(item: MediaItem): string {
  if ('artists' in item && item.artists?.length) return item.artists.map((a) => a.name).join(', ');
  if ('authors' in item && item.authors?.length) return item.authors.map((a) => a.name).join(', ');
  return item.subtitle ?? '';
}

export function imageUrl(holder: ImageHolder | null | undefined): string | undefined {
  if (!holder) return undefined;
  if (holder.type.endsWith('NetworkRequestImageHolder')) return holder.request?.url;
  if (holder.type.endsWith('ResourceUriImageHolder')) return holder.uri;
  return undefined;
}

export function isPlayable(track: Track): boolean {
  return track.isPlayable?.type?.endsWith('.Yes') ?? true;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Duration in ms (as the server sends it) to m:ss. */
export function formatDuration(ms: number | null | undefined): string {
  return ms ? formatTime(ms / 1000) : '';
}

// Navigation -----------------------------------------------------------------

const MEMORY_PREFIX = 'echo:item:';

/** Keeps the full object for pages that need it (artists, playlists) across navigation. */
export function remember(item: MediaItem): void {
  try {
    sessionStorage.setItem(`${MEMORY_PREFIX}${kindOf(item)}:${item.id}`, JSON.stringify(item));
  } catch {
    /* storage can be unavailable; pages fall back to stubs */
  }
}

export function recall<T extends MediaItem>(kind: Kind, id: string): T | null {
  try {
    const raw = sessionStorage.getItem(`${MEMORY_PREFIX}${kind}:${id}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Route for opening a media item, or null when it can't be opened. */
export function routeFor(item: MediaItem): string | null {
  switch (kindOf(item)) {
    case 'Album':
      return `/work/${encodeURIComponent(item.id)}`;
    case 'Artist':
      return `/artist/${encodeURIComponent(item.id)}`;
    case 'Playlist':
      return `/playlist/${encodeURIComponent(item.id)}`;
    case 'Track': {
      const track = item as Track;
      // Playlist placeholders have no work id in extras; their id is the work id.
      const workId = track.extras?.id ?? (track.streamables?.[0]?.id === 'OPEN_ALBUM' ? track.id : undefined);
      return workId ? `/work/${encodeURIComponent(workId)}` : null;
    }
    default:
      return null;
  }
}

/** Albums only need their id to load (the server fetches details), so a stub is enough. */
export function albumStub(id: string, title = ''): Album {
  return { mediaItemType: `${MODEL_PREFIX}Album`, id, title, artists: [], trackCount: null, duration: null, cover: null, extras: {} } as Album;
}

export function artistStub(artist: Artist): Artist {
  return { ...artist, mediaItemType: `${MODEL_PREFIX}Artist` };
}

export function playlistStub(id: string): Playlist {
  return {
    mediaItemType: `${MODEL_PREFIX}Playlist`, id, title: 'Playlist', isEditable: false,
    isPrivate: true, authors: [], trackCount: null, cover: null, extras: {},
  } as Playlist;
}
