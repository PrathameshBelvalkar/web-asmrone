import type { Feed } from '../feed.js';
import type { EchoMediaItem, Track } from './media.js';
import type { Extras, ImageHolder } from './common.js';

export type ShelfLayout = 'Linear' | 'Grid';

export interface ShelfLists<T> {
  readonly id: string;
  readonly title: string;
  readonly list: readonly T[];
  readonly subtitle: string | null;
  readonly layout: ShelfLayout;
  /** Not serialised; the view registers it and sends `moreFeedId`. */
  readonly more: Feed<Shelf> | null;
  readonly extras: Extras;
}

export type Shelf =
  | ({ readonly shelfKind: 'Items' } & ShelfLists<EchoMediaItem>)
  | ({ readonly shelfKind: 'Tracks' } & ShelfLists<Track>)
  | ({ readonly shelfKind: 'Categories' } & ShelfLists<ShelfCategory>)
  | { readonly shelfKind: 'Item'; readonly media: EchoMediaItem }
  | ({ readonly shelfKind: 'Category' } & ShelfCategory);

export interface ShelfCategory {
  readonly id: string;
  readonly title: string;
  /** Not serialised; the view registers it and sends `feedId`. */
  readonly feed: Feed<Shelf> | null;
  readonly subtitle: string | null;
  readonly image: ImageHolder | null;
  readonly backgroundColor: string | null;
  readonly extras: Extras;
}
