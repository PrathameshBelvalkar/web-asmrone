import type { ImageHolder } from './echo/common.js';
import type { Tab } from './echo/common.js';
import type { Track } from './echo/media.js';
import type { EchoMediaItem } from './echo/media.js';
import type { Lyrics } from './echo/lyrics.js';
import type { Shelf } from './echo/shelf.js';
import type { Feed } from './feed.js';
import type { Json } from './json.js';

/**
 * What a view needs from the server while it builds JSON: registering a feed (returns its id)
 * and allowing an upstream URL through the proxy. Views stay pure apart from these two calls.
 */
export interface ViewContext {
  readonly registerFeed: (feed: Feed<unknown>) => string;
  readonly issueUrl: (url: string, headers?: Readonly<Record<string, string>>) => void;
}

/** A feed opened for the client: ids, tabs, and the flags the screen needs. */
export interface OpenedFeed {
  readonly feedId: string;
  readonly pagedId: string;
  readonly tabs: readonly Tab[];
  readonly selectedTab: string | null;
  readonly showSearch: boolean;
  readonly showSort: boolean;
  readonly showPlayAndShuffle: boolean;
  readonly background: ImageHolder | null;
  readonly customTracks: readonly Track[] | null;
}

/** A setting ready to show: current value resolved from storage or the default. */
export interface ResolvedSetting {
  readonly kind: 'category' | 'switch' | 'list' | 'multi' | 'slider' | 'text' | 'info' | 'button';
  readonly key: string;
  readonly title: string;
  readonly summary: string | null;
  readonly options: readonly { readonly title: string; readonly value: string }[] | null;
  readonly value: Json;
  readonly min: number | null;
  readonly max: number | null;
  readonly steps: number | null;
  readonly children: readonly ResolvedSetting[] | null;
}

/** One item of a paged list: a shelf, a media item, or lyrics. */
export type PageItem = Shelf | EchoMediaItem | Lyrics;
