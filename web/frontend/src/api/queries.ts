import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { api } from './client';
import type { Album, Artist, Lyrics, MediaItem, Playlist, SourceId, ToolsStatus, Track } from './types';
import { usePlayer } from '../player/store';

/** Shared cache times. Content is long-lived; user-specific data is shorter. */
const MIN = 60_000;
export const STALE = {
  content: 10 * MIN, // home, search, works, tracks, lyrics: change rarely
  user: 5 * MIN, // login, settings
  live: 1 * MIN, // playlists, library, likes
};

/* Every read the app makes is defined here, so a key always means the same request. */

export const meOptions = () =>
  queryOptions({ queryKey: ['me'], queryFn: () => api.me(), staleTime: STALE.user });

export const formsOptions = () =>
  queryOptions({ queryKey: ['forms'], queryFn: () => api.authForms(), staleTime: Infinity });

export const settingsOptions = () =>
  queryOptions({ queryKey: ['settings'], queryFn: () => api.settings(), staleTime: STALE.user });

export const homeOptions = (source: SourceId) =>
  queryOptions({ queryKey: ['home', source], queryFn: () => api.home(source), staleTime: STALE.content });

export const libraryOptions = () =>
  queryOptions({ queryKey: ['library'], queryFn: () => api.library(), staleTime: STALE.live, retry: false });

export const searchOptions = (q: string, source: SourceId) =>
  queryOptions({ queryKey: ['search', source, q], queryFn: () => api.search(q, source), staleTime: STALE.content, enabled: q.length > 0 });

export const quickSearchOptions = (q: string, source: SourceId) =>
  queryOptions({ queryKey: ['quick', source, q], queryFn: () => api.quickSearch(q, source), staleTime: STALE.content, enabled: q.length > 0 });

export const feedOptions = (feedId: string, tab: string | null = null) =>
  queryOptions({
    queryKey: ['feed', feedId, tab],
    queryFn: () => api.openFeed(feedId, tab),
    staleTime: STALE.content,
    enabled: feedId.length > 0,
  });

/** One feed's pages. Keyed by the server's paged id, so reopening the same feed reuses the pages. */
export const pagesOptions = (pagedId: string | null | undefined) =>
  infiniteQueryOptions({
    queryKey: ['pages', pagedId ?? ''],
    queryFn: ({ pageParam }) => api.page(pagedId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.continuation ?? undefined,
    staleTime: STALE.content,
    retry: false,
    enabled: !!pagedId,
  });

export const albumOptions = (album: Album) =>
  queryOptions({ queryKey: ['work', album.id], queryFn: () => api.albumLoad(album), staleTime: STALE.content });

export const albumFeedOptions = (album: Album) =>
  queryOptions({ queryKey: ['workFeed', album.id], queryFn: () => api.albumFeed(album), staleTime: STALE.content });

export const albumTracksOptions = (album: Album) =>
  queryOptions({ queryKey: ['workTracks', album.id], queryFn: () => api.albumTracks(album), staleTime: STALE.content });

export const artistFeedOptions = (artist: Artist) =>
  queryOptions({ queryKey: ['artistFeed', artist.id], queryFn: () => api.artistFeed(artist), staleTime: STALE.content });

export const playlistTracksOptions = (playlist: Playlist) =>
  queryOptions({ queryKey: ['playlistTracks', playlist.id], queryFn: () => api.playlistTracks(playlist), staleTime: STALE.live });

export const editableOptions = (track: Track) =>
  queryOptions({ queryKey: ['editable', track.id], queryFn: () => api.playlistsEditable(track), staleTime: STALE.live });

export const likeOptions = (item: MediaItem) =>
  queryOptions({ queryKey: ['like', item.id], queryFn: () => api.likeStatus(item), staleTime: STALE.live });

/** The listening position when `track` is the one playing, so AI subtitles start there. */
function playingPositionMs(track: Track): number | undefined {
  const { queue, index, position } = usePlayer.getState();
  return queue[index]?.id === track.id ? Math.round(position * 1000) : undefined;
}

/** True while AI subtitles for the track are still being made (the server is polled). */
export const aiSubtitlesPending = (lyrics: Lyrics | null | undefined) => {
  return lyrics?.extras?.aiStatus === 'running';
};

/**
 * Lyrics never change once found. AI subtitles that are still being made are polled every 2 s, and
 * any unfinished AI result (pending, failed, unavailable) is refetched the next time it is shown.
 */
export const lyricsOptions = (track: Track) =>
  queryOptions({
    queryKey: ['lyrics', track.id],
    queryFn: () => api.lyrics(track, playingPositionMs(track)),
    staleTime: (query) => {
      const data = query.state.data;
      const extras = data?.extras;
      // Unfinished AI results, and finished ones with no lines, are checked again when shown.
      return extras?.aiGenerated && (extras.aiStatus !== 'done' || !data?.lyrics) ? 0 : Infinity;
    },
    refetchInterval: (query) => (aiSubtitlesPending(query.state.data) ? 2000 : false),
  });

/** The playable stream for a track. */
export const mediaOptions = (track: Track) =>
  queryOptions({ queryKey: ['media', track.id], queryFn: () => api.trackMedia(track), staleTime: STALE.content });

export const radioOptions = (item: MediaItem) =>
  queryOptions({ queryKey: ['radio', item.id], queryFn: () => api.radio(item), staleTime: STALE.content });

export const shareOptions = (item: MediaItem) =>
  queryOptions({ queryKey: ['share', item.id], queryFn: () => api.share(item), staleTime: STALE.content });

/** True while a model is downloading or being checked, or the speed test runs. */
export const toolsBusy = (data: ToolsStatus | undefined) =>
  data?.download.status === 'downloading' ||
  data?.download.status === 'verifying' ||
  data?.benchmark.status === 'running';

/** AI subtitle setup. Polled once a second while something is running. */
export const toolsOptions = () =>
  queryOptions({
    queryKey: ['tools'],
    queryFn: () => api.tools(),
    staleTime: 0,
    refetchInterval: (query) => (toolsBusy(query.state.data) ? 1000 : false),
  });
