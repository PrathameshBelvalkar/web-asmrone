// Shapes returned by the Echo Web server. Discriminators are fully-qualified class names.

export const MODEL_PREFIX = 'dev.brahmkshatriya.echo.common.models.';

/** Music sources: asmr.one (default) and japaneseasmr.com. */
export type SourceId = 'asmrone' | 'jasmr' | 'jnet' | 'hasmr';

export type Kind = 'Track' | 'Album' | 'Artist' | 'Playlist' | 'Radio';

export interface ImageHolder {
  type: string;
  request?: { url: string; headers: Record<string, string> };
  uri?: string;
  hex?: string;
  crop?: boolean;
}

interface MediaBase {
  mediaItemType: string;
  id: string;
  title: string;
  cover?: ImageHolder | null;
  background?: ImageHolder | null;
  subtitle?: string | null;
  description?: string | null;
  extras: Record<string, string>;
}

export interface Artist {
  mediaItemType: string;
  id: string;
  name: string;
  cover?: ImageHolder | null;
  bio?: string | null;
  subtitle?: string | null;
  extras: Record<string, string>;
}

export interface Album extends MediaBase {
  artists: Artist[];
  trackCount: number | null;
  duration: number | null;
  isExplicit?: boolean;
}

export interface Playlist extends MediaBase {
  isEditable: boolean;
  isPrivate: boolean;
  authors: Artist[];
  trackCount: number | null;
}

export interface Radio extends MediaBase {}

export interface Streamable {
  id: string;
  quality: number;
}

export interface Track extends MediaBase {
  artists: Artist[];
  album: Album | null;
  duration: number | null;
  isPlayable: { type: string };
  streamables: Streamable[];
}

export type MediaItem = Track | Album | Artist | Playlist | Radio;

export interface ShelfDto {
  kind: 'items' | 'tracks' | 'categories' | 'item' | 'category';
  id: string;
  title: string;
  subtitle?: string | null;
  horizontal?: boolean;
  moreFeedId?: string | null;
  items?: FeedEntry[] | null;
  item?: MediaItem | null;
  categories?: CategoryDto[] | null;
  category?: CategoryDto | null;
}

export interface CategoryDto {
  id: string;
  title: string;
  subtitle?: string | null;
  image?: ImageHolder | null;
  backgroundColor?: string | null;
  feedId?: string | null;
}

/** A feed entry is either a shelf (from shelf feeds) or a media item (from track/album lists). */
export type FeedEntry = ShelfDto | MediaItem;

export interface Tab {
  id: string;
  title: string;
  isSort: boolean;
}

export interface FeedDto {
  feedId?: string | null;
  pagedId?: string | null;
  tabs: Tab[];
  selectedTab?: string | null;
  showSearch: boolean;
  showSort: boolean;
  showPlayAndShuffle: boolean;
  background?: ImageHolder | null;
  customTracks?: Track[] | null;
}

export interface PageDto {
  items: FeedEntry[];
  continuation: string | null;
}

export interface RadioDto {
  radio: Radio;
  feed: FeedDto;
}

export interface EditableDto {
  playlist: Playlist;
  contains: boolean;
}

export type QuickSearchItem =
  | { quickSearchItemType: string; query: string; searched: boolean }
  | { quickSearchItemType: string; media: MediaItem; searched: boolean };

export interface Lyric {
  text: string;
  startTime: number;
  endTime: number;
}

export interface Lyrics {
  id: string;
  title: string;
  subtitle?: string | null;
  lyrics: { type: string; list?: Lyric[]; text?: string } | null;
  /**
   * AI subtitles set `aiGenerated` and `aiStatus`. While running: `aiPhase` (starting, transcribing),
   * `aiCoveredMs`, `aiCovered` ("start-end,…" in ms), and `aiTotalMs`/`aiProgress` when the length is
   * known. `aiMessage` explains failed and unavailable.
   */
  extras?: Record<string, string>;
}

/** Status of AI-generated subtitles (`extras.aiStatus`). */
export type AiStatus = 'running' | 'done' | 'failed' | 'unavailable';

export interface MediaSource {
  sourceType: string;
  /** Progressive file or HLS playlist. */
  type?: string;
  request?: { url: string; headers: Record<string, string> };
  title?: string | null;
}

export interface StreamMedia {
  mediaType: string;
  sources: MediaSource[];
  merged: boolean;
}

export interface SettingOption {
  title: string;
  value: string;
}

export interface SettingDto {
  kind: 'category' | 'switch' | 'list' | 'multi' | 'slider' | 'text' | 'info' | 'button';
  key: string;
  title: string;
  summary?: string | null;
  options?: SettingOption[] | null;
  value?: unknown;
  min?: number | null;
  max?: number | null;
  steps?: number | null;
  children?: SettingDto[] | null;
}

export interface FormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

export interface LoginForm {
  key: string;
  label: string;
  fields: FormField[];
}

export interface User {
  id: string;
  name: string;
  cover?: ImageHolder | null;
  subtitle?: string | null;
}

/* AI subtitle setup (`GET /api/tools`). Mirrors the server's ToolsStatus. */

export type Variant = 'metal' | 'vulkan' | 'cpu' | 'system';

export type DownloadState =
  | { status: 'idle' }
  | { status: 'downloading'; modelId: string; received: number; total: number; bytesPerSecond: number }
  | { status: 'verifying'; modelId: string }
  | { status: 'failed'; modelId: string; message: string };

export interface ToolsModel {
  id: string;
  title: string;
  note: string;
  size: number;
  installed: boolean;
  selected: boolean;
  recommended: boolean;
  partialBytes: number;
}

export interface ToolsStatus {
  desktop: boolean;
  appVersion: string | null;
  ffmpeg: { found: boolean };
  engine: { variants: Variant[]; selected: Variant | null };
  models: ToolsModel[];
  download: DownloadState;
  benchmark: { status: 'idle' | 'running' | 'done' | 'failed'; speedFactor: number | null; message: string | null };
  freeDiskBytes: number;
  enabled: boolean;
  problem: string | null;
  ready: boolean;
}
