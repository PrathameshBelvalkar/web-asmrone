// Shapes returned by the Echo Web server. Discriminators are fully-qualified class names.

export const MODEL_PREFIX = "dev.brahmkshatriya.echo.common.models.";

/** Music sources: asmr.one (default) and japaneseasmr.com. */
export type SourceId = "asmrone" | "jasmr" | "jnet" | "hasmr";

export type Kind = "Track" | "Album" | "Artist" | "Playlist" | "Radio";

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
  kind: "items" | "tracks" | "categories" | "item" | "category";
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
export type AiStatus = "running" | "done" | "failed" | "unavailable";

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
  kind:
    | "category"
    | "switch"
    | "list"
    | "multi"
    | "slider"
    | "text"
    | "info"
    | "button";
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

/** Settings › Storage (`GET /api/storage`). */
export interface StorageUsage {
  subtitlesBytes: number;
  partialBytes: number;
}

/* AI subtitle setup (`GET /api/tools`). Mirrors the server's ToolsStatus. */

export type Variant = "metal" | "cpu" | "system";

export type DownloadState =
  | { status: "idle" }
  | {
      status: "downloading";
      modelId: string;
      received: number;
      total: number;
      bytesPerSecond: number;
    }
  | { status: "verifying"; modelId: string }
  | { status: "failed"; modelId: string; message: string };

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
  benchmark: {
    status: "idle" | "running" | "done" | "failed";
    speedFactor: number | null;
    message: string | null;
  };
  freeDiskBytes: number;
  enabled: boolean;
  paused: boolean;
  pausedModelId: string | null;
  problem: string | null;
  ready: boolean;
}

// Manga & Doujinshi ------------------------------------------------------------

export type MangaTagKind = "tag" | "artist" | "character" | "parody" | "group" | "language" | "category";
export type MangaIndexKind = "tag" | "artist" | "character" | "parody" | "group";
export type MangaSort = "new" | "popular" | "24h" | "7d";

export interface MangaCard {
  id: string;
  title: string;
  /** The site's flag code (`eng`, `jpn`, `zho`, …). */
  language: string | null;
  cover: string;
  coverFallbacks: string[];
  /** Height divided by width. */
  aspect: number | null;
}

export interface MangaTag {
  kind: MangaTagKind;
  slug: string;
  name: string;
  count: number | null;
}

export interface MangaPage {
  n: number;
  url: string;
  thumb: string;
  width: number | null;
  height: number | null;
}

export interface MangaGallery {
  id: string;
  title: string;
  titleJapanese: string | null;
  prettyTitle: string | null;
  cover: string;
  /** Other cover addresses to try, in order, when `cover` fails. */
  coverFallbacks: string[];
  pages: MangaPage[];
  tags: MangaTag[];
  uploadedAt: string | null;
  scanlator: string | null;
}

export interface MangaList {
  /** On a tag, artist or other single-name list: that name, with its gallery count. */
  tag: MangaTag | null;
  items: MangaCard[];
  page: number;
  lastPage: number | null;
  hasMore: boolean;
}

export interface MangaIndex {
  items: MangaTag[];
  page: number;
  lastPage: number | null;
}

/** What a gallery list shows: Browse, a search, or one tag, artist, language… */
export type MangaListQuery =
  | { by: "browse"; sort: "new" | "popular" }
  | { by: "search"; q: string }
  | { by: MangaTagKind; slug: string; sort: MangaSort };

// JAV -------------------------------------------------------------------------

export type JavKind = "censored" | "uncensored";
export type JavListBy = "genre" | "studio" | "director";
export type JavMovieSort = "release" | "most_favorited" | "top_rated";
export type JavIdolSort = "debut" | "name" | "top_rated" | "most_favorited" | "newest";
export type JavNewsCategory = "top-jav-movies" | "new-jav-debuts" | "top-jav-idols" | "idol-updates" | "site-updates";

/** A genre, studio, director, series or news category. */
export interface JavRef {
  slug: string;
  name: string;
}

export interface JavMovieCard {
  slug: string;
  kind: JavKind;
  /** `SAVR-1268`. Uncensored movies have none. */
  dvdId: string | null;
  title: string;
  /** `YYYY-MM-DD`. */
  releaseDate: string | null;
  /** Not out yet in Japan. */
  upcoming: boolean;
  cover: string | null;
  studio: JavRef | null;
}

export interface JavMovie extends JavMovieCard {
  contentId: string | null;
  coverFull: string | null;
  runtimeMin: number | null;
  series: JavRef | null;
  director: JavRef | null;
  genres: JavRef[];
  idols: JavIdolCard[];
  samples: { thumb: string; full: string }[];
  /** On the studio's or DMM's host; the browser loads it directly. */
  trailer: string | null;
  similar: JavMovieCard[];
}

/** A full movie's HLS stream. Load `master` through the proxy; its segments load from their host. */
export interface JavStream {
  server: "sb";
  master: string;
  /** Epoch ms after which the stream should be asked for again. */
  expiresAt: number;
}

export interface JavIdolCard {
  slug: string;
  name: string;
  photo: string | null;
  age: number | null;
}

export interface JavIdol extends JavIdolCard {
  photoFull: string | null;
  nameJapanese: string | null;
  altNames: string[];
  dob: string | null;
  debut: string | null;
  debutAge: number | null;
  birthplace: string | null;
  sign: string | null;
  blood: string | null;
  measurements: string | null;
  cup: string | null;
  heightCm: number | null;
  shoeSize: string | null;
  hairLength: string[];
  hairColor: string[];
  tags: string[];
  bio: string | null;
  censoredCount: number | null;
  uncensoredCount: number | null;
  movies: JavList<JavMovieCard>;
  related: JavIdolCard[];
}

export interface JavList<T> {
  items: T[];
  page: number;
  lastPage: number | null;
  hasMore: boolean;
}

export interface JavMovieList extends JavList<JavMovieCard> {
  /** On a genre, studio or director list: its name. */
  heading?: string | null;
}

export interface JavGenreGroup {
  name: string;
  genres: JavRef[];
}

export interface JavNewsItem {
  /** `2026/11/13/slug`. */
  path: string;
  url: string;
  title: string;
  date: string;
  categories: JavRef[];
  summary: string;
  image: string | null;
}

export type JavRankedEntry =
  | { rank: number; type: "movie"; movie: JavMovieCard }
  | { rank: number; type: "idol"; idol: JavIdolCard };

export interface JavNewsPost {
  path: string;
  url: string;
  title: string;
  date: string;
  intro: string;
  ranked: JavRankedEntry[];
}

/** What a movie grid shows. */
export type JavMovieQuery =
  | { by: "movies"; kind: JavKind; sort: JavMovieSort }
  | { by: "latest"; kind: JavKind }
  | { by: "upcoming"; kind: JavKind }
  | { by: JavListBy; slug: string }
  /** `kind` limits a search to censored or uncensored movies. */
  | { by: "search"; q: string; kind?: JavKind }
  /** `solo`: only the movies where she is the one actress. */
  | { by: "idol"; slug: string; solo?: boolean };

/** Idol filters, by Echo's query names. Values are the site's facet values. */
export interface JavIdolFilters {
  content?: string[];
  age?: string[];
  cup?: string[];
  body?: string[];
  hairLength?: string[];
  hairColor?: string[];
  /** `2024` or `2020-2026`. */
  debutYear?: string;
}

/** What an idol grid shows. */
export type JavIdolQuery = { by: "all"; sort: JavIdolSort; filters: JavIdolFilters } | { by: "search"; q: string };
