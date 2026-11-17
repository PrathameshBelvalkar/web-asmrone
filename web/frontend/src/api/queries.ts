import { infiniteQueryOptions, keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from './client';
import type {
  Album,
  Artist,
  HanimeBrowse,
  JavIdolQuery,
  JavKind,
  JavMovieQuery,
  JavNewsCategory,
  Lyrics,
  MangaIndexKind,
  MangaListQuery,
  MediaItem,
  Playlist,
  SourceId,
  ToolsStatus,
  Track,
} from './types';
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

export const storageOptions = () =>
  queryOptions({
    queryKey: ['storage'],
    queryFn: () => api.storage(),
    staleTime: 0,
  });

/** A gallery list, one site page per query page. */
export const mangaListOptions = (query: MangaListQuery) =>
  infiniteQueryOptions({
    queryKey: ['manga', 'list', query],
    queryFn: ({ pageParam }) => api.manga.list(query, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: STALE.content,
    enabled: query.by !== 'search' || query.q.length > 0,
  });

export const mangaIndexOptions = (kind: MangaIndexKind, letter: string | null, sort: 'az' | 'popular', page: number) =>
  queryOptions({
    queryKey: ['manga', 'index', kind, letter, sort, page],
    queryFn: () => api.manga.index(kind, letter, sort, page),
    staleTime: STALE.content,
  });

/** Tag (or artist, …) names containing `q`. The first search for a letter can take a few seconds. */
export const mangaIndexSearchOptions = (kind: MangaIndexKind, q: string) =>
  queryOptions({
    queryKey: ['manga', 'indexSearch', kind, q.toLowerCase()],
    queryFn: () => api.manga.searchIndex(kind, q),
    staleTime: STALE.content,
    enabled: q.length > 0,
  });

/** A gallery never changes once uploaded. A blocked or missing one (451, 404) isn't retried. */
export const mangaGalleryOptions = (id: string) =>
  queryOptions({
    queryKey: ['manga', 'gallery', id],
    queryFn: () => api.manga.gallery(id),
    staleTime: Infinity,
    retry: (count, error) => count < 2 && !('status' in error && [404, 451].includes((error as { status: number }).status)),
  });

/** A refused (451) or missing (404) JAV page isn't retried, nor one asked while the server backs off (503). */
const javRetry = (count: number, error: Error) =>
  count < 2 && !('status' in error && [404, 451, 503].includes((error as { status: number }).status));

/** News posts, newest first, one site page per query page. */
export const javNewsOptions = (category: JavNewsCategory | null) =>
  infiniteQueryOptions({
    queryKey: ['jav', 'news', category],
    queryFn: ({ pageParam }) => api.jav.news(category, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: STALE.content,
  });

export const javNewsPostOptions = (path: string) =>
  queryOptions({
    queryKey: ['jav', 'newsPost', path],
    queryFn: () => api.jav.newsPost(path),
    staleTime: 60 * MIN,
    retry: javRetry,
  });

/** A movie list: Movies, Latest, Upcoming, a genre, studio or director, a search, or an idol's movies. */
export const javMoviesOptions = (query: JavMovieQuery) =>
  infiniteQueryOptions({
    queryKey: ['jav', 'movies', query],
    queryFn: ({ pageParam }) => api.jav.movies(query, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: STALE.content,
    retry: javRetry,
    enabled: query.by !== 'search' || query.q.length > 0,
  });

export const javMovieOptions = (kind: string, slug: string) =>
  queryOptions({
    queryKey: ['jav', 'movie', kind, slug],
    queryFn: () => api.jav.movie(kind, slug),
    staleTime: 60 * MIN,
    retry: javRetry,
  });

/**
 * Search suggestions: the first few results of a movie or idol search. Each new query keeps the last
 * suggestions on screen until its own arrive.
 */
export const javSuggestOptions = (type: 'movies' | 'idols', q: string, kind?: JavKind) =>
  queryOptions({
    queryKey: ['jav', 'suggest', type, kind ?? 'all', q.toLowerCase()],
    queryFn: async () =>
      type === 'idols'
        ? { movies: [], idols: (await api.jav.idols({ by: 'search', q }, 1)).items.slice(0, 8) }
        : { movies: (await api.jav.movies({ by: 'search', q, kind }, 1)).items.slice(0, 8), idols: [] },
    staleTime: STALE.content,
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
    retry: false,
  });

export const javIdolsOptions = (query: JavIdolQuery) =>
  infiniteQueryOptions({
    queryKey: ['jav', 'idols', query],
    queryFn: ({ pageParam }) => api.jav.idols(query, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: STALE.content,
    enabled: query.by !== 'search' || query.q.length > 0,
  });

export const javIdolOptions = (slug: string) =>
  queryOptions({
    queryKey: ['jav', 'idol', slug],
    queryFn: () => api.jav.idol(slug),
    staleTime: 60 * MIN,
    retry: javRetry,
  });

/** The genre list changes rarely. */
export const javGenresOptions = () =>
  queryOptions({
    queryKey: ['jav', 'genres'],
    queryFn: () => api.jav.genres(),
    staleTime: 24 * 60 * MIN,
  });

/** Hanime: the server answers from its own copy of the catalog, so nothing here is slow or rate-limited. */
const hanimeRetry = (count: number, error: Error) =>
  count < 2 && !('status' in error && [400, 404, 451].includes((error as { status: number }).status));

export const hanimeHomeOptions = () =>
  queryOptions({ queryKey: ['hanime', 'home'], queryFn: () => api.hanime.home(), staleTime: STALE.content, retry: hanimeRetry });

/** Browse and search: every filter, sort and page comes from the server's copy. */
export const hanimeTitlesOptions = (browse: HanimeBrowse) =>
  infiniteQueryOptions({
    queryKey: ['hanime', 'titles', browse],
    queryFn: ({ pageParam }) => api.hanime.titles(browse, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: STALE.content,
    retry: hanimeRetry,
  });

export const hanimeTitleOptions = (slug: string) =>
  queryOptions({ queryKey: ['hanime', 'title', slug], queryFn: () => api.hanime.title(slug), staleTime: STALE.content, retry: hanimeRetry });

/** The title page's Preview storyboard, length and other names: read from the site, so slower. */
export const hanimeDetailsOptions = (slug: string) =>
  queryOptions({
    queryKey: ['hanime', 'details', slug],
    queryFn: () => api.hanime.details(slug),
    staleTime: 60 * MIN,
    // Like JAV pages: a refused, missing or busy (503) answer isn't asked again.
    retry: javRetry,
  });

export const hanimeSeasonsOptions = (year: number | null) =>
  queryOptions({
    queryKey: ['hanime', 'seasons', year],
    queryFn: () => api.hanime.seasons(year),
    staleTime: STALE.content,
    retry: hanimeRetry,
    placeholderData: keepPreviousData,
  });

export const hanimeTagsOptions = () =>
  queryOptions({ queryKey: ['hanime', 'tags'], queryFn: () => api.hanime.tags(), staleTime: STALE.content, retry: hanimeRetry });

export const hanimeStudiosOptions = () =>
  queryOptions({ queryKey: ['hanime', 'studios'], queryFn: () => api.hanime.studios(), staleTime: STALE.content, retry: hanimeRetry });

/** Suggestions as you type. Each new query keeps the last ones on screen until its own arrive. */
export const hanimeSuggestOptions = (q: string) =>
  queryOptions({
    queryKey: ['hanime', 'suggest', q.toLowerCase()],
    queryFn: () => api.hanime.suggest(q),
    staleTime: STALE.content,
    enabled: q.length >= 1,
    placeholderData: keepPreviousData,
    retry: false,
  });

export const hanimeStatusOptions = () =>
  queryOptions({ queryKey: ['hanime', 'status'], queryFn: () => api.hanime.status(), staleTime: STALE.live, refetchInterval: 60_000 });
