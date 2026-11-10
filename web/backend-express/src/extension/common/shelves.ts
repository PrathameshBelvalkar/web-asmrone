import type { Album } from '../../models/echo/media.js';
import type { Shelf, ShelfCategory } from '../../models/echo/shelf.js';
import type { Feed } from '../../models/feed.js';

/** Shelf builders shared by the sources that list works (jasmr.net, hentaiasmr.moe). */

/** One item as a shelf (feeds list one item per shelf). */
export function itemShelf(media: Album): Shelf {
  return { shelfKind: 'Item', media };
}

/** A row of items, optionally with a "See all" feed. */
export function itemsShelf(
  id: string,
  title: string,
  list: readonly Album[],
  more: Feed<Shelf> | null = null,
): Shelf {
  return {
    shelfKind: 'Items',
    id,
    title,
    list,
    subtitle: null,
    layout: 'Linear',
    more,
    extras: {},
  };
}

/** A row of category chips, each opening its own feed. */
export function categoriesShelf(
  id: string,
  title: string,
  list: readonly ShelfCategory[],
  subtitle: string | null = null,
): Shelf {
  return {
    shelfKind: 'Categories',
    id,
    title,
    list,
    subtitle,
    layout: 'Linear',
    more: null,
    extras: {},
  };
}

export function browseCategory(
  id: string,
  title: string,
  feed: Feed<Shelf>,
  subtitle: string | null = null,
): ShelfCategory {
  return { id, title, feed, subtitle, image: null, backgroundColor: null, extras: {} };
}
