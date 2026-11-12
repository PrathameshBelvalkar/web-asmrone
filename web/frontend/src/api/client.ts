import type {
  Album, Artist, EditableDto, FeedDto, Lyrics, LoginForm, MediaItem,
  PageDto, Playlist, QuickSearchItem, RadioDto, SettingDto, SourceId, StreamMedia, Track, ToolsStatus, User,
} from './types';
import { MODEL_PREFIX } from './types';

export class ApiError extends Error {
  constructor(public status: number, public type: string, message: string) {
    super(message);
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.type ?? 'error', data?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

const enc = encodeURIComponent;

/** The server decodes media by `mediaItemType`; nested objects (artists, albums) lack it. */
export function typed<T extends MediaItem>(kind: 'Album' | 'Artist' | 'Playlist' | 'Track' | 'Radio', obj: object): T {
  return { mediaItemType: `${MODEL_PREFIX}${kind}`, ...obj } as T;
}

export const api = {
  home: (source: SourceId) => req<FeedDto>('GET', `/home?source=${enc(source)}`),
  library: () => req<FeedDto>('GET', '/library'),
  search: (q: string, source: SourceId) => req<FeedDto>('GET', `/search?q=${enc(q)}&source=${enc(source)}`),
  quickSearch: (q: string, source: SourceId) =>
    req<QuickSearchItem[]>('GET', `/quicksearch?q=${enc(q)}&source=${enc(source)}`),
  openFeed: (feedId: string, tab?: string | null) =>
    req<FeedDto>('GET', `/feeds/${enc(feedId)}/open${tab ? `?tab=${enc(tab)}` : ''}`),
  page: (pagedId: string, cont?: string | null) =>
    req<PageDto>('GET', `/pages/${enc(pagedId)}${cont ? `?cont=${enc(cont)}` : ''}`),

  albumLoad: (item: Album) => req<Album>('POST', '/album/load', { item }),
  albumFeed: (item: Album) => req<FeedDto>('POST', '/album/feed', { item }),
  albumTracks: (item: Album) => req<FeedDto>('POST', '/album/tracks', { item }),
  artistLoad: (item: Artist) => req<Artist>('POST', '/artist/load', { item }),
  artistFeed: (item: Artist) => req<FeedDto>('POST', '/artist/feed', { item }),
  playlistLoad: (item: Playlist) => req<Playlist>('POST', '/playlist/load', { item }),
  playlistTracks: (item: Playlist) => req<FeedDto>('POST', '/playlist/tracks', { item }),
  playlistDelete: (item: Playlist) => req<void>('POST', '/playlists/delete', { item }),
  playlistEdit: (item: Playlist, title: string, description: string | null) =>
    req<void>('POST', '/playlists/edit', { item, title, description }),
  playlistPrivacy: (item: Playlist, isPrivate: boolean) =>
    req<void>('POST', '/playlists/privacy', { item, isPrivate }),
  playlistCreate: (title: string, description: string | null) =>
    req<Playlist>('POST', '/playlists/create', { title, description }),
  playlistsEditable: (track: Track) =>
    req<EditableDto[]>('POST', '/playlists/editable', { track }),
  playlistAddTrack: (item: Playlist, track: Track) =>
    req<void>('POST', '/playlists/add-tracks', { item, tracks: [], index: 0, new: [track] }),
  trackLoad: (item: Track) => req<Track>('POST', '/track/load', { item }),
  trackMedia: (item: Track) => req<StreamMedia>('POST', '/track/media', { item }),
  /** `positionMs` (the listening position) tells the server where to start AI subtitles. */
  lyrics: (item: Track, positionMs?: number) => req<Lyrics | null>('POST', '/lyrics', { item, positionMs }),
  radio: (item: MediaItem) => req<RadioDto>('POST', '/radio', { item }),
  share: (item: MediaItem) => req<{ url: string }>('POST', '/share', { item }),
  like: (item: MediaItem, shouldLike: boolean) => req<void>('POST', '/like', { item, shouldLike }),
  likeStatus: (item: MediaItem) => req<LikeStatusDto>('POST', '/like/status', { item }),

  authForms: () => req<LoginForm[]>('GET', '/auth/forms'),
  login: (key: string, data: Record<string, string>) => req<User>('POST', '/auth/login', { key, data }),
  logout: () => req<void>('POST', '/auth/logout'),
  me: () => req<User | null>('GET', '/auth/me'),

  settings: () => req<SettingDto[]>('GET', '/settings'),
  putSetting: (key: string, value: unknown) => req<void>('PUT', `/settings/${enc(key)}`, { value }),

  tools: () => req<ToolsStatus>('GET', '/tools'),
  setupTools: () => req<void>('POST', '/tools/setup'),
  downloadModel: (id: string) => req<void>('POST', `/tools/models/${enc(id)}/download`),
  cancelDownload: () => req<void>('POST', '/tools/download/cancel'),
  selectModel: (id: string) => req<void>('PUT', '/tools/model', { id }),
  deleteModel: (id: string) => req<void>('POST', `/tools/models/${enc(id)}/delete`),
  runBenchmark: () => req<void>('POST', '/tools/benchmark'),
};

export interface LikeStatusDto {
  liked: boolean;
}

export const proxyUrl = (url: string) => `/api/proxy?url=${enc(url)}`;
