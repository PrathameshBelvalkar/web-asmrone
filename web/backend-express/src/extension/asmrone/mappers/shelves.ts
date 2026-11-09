import { feedOfPaged, type Feed } from '../../../models/feed.js';
import { PagedData } from '../../../models/paged-data.js';
import type { EchoMediaItem } from '../../../models/echo/media.js';
import type { Shelf, ShelfCategory, ShelfLayout } from '../../../models/echo/shelf.js';
import type { Pagination } from '../api/upstream.schemas.js';

export function itemsShelf(
  id: string,
  title: string,
  list: readonly EchoMediaItem[],
  more: Feed<Shelf> | null = null,
  layout: ShelfLayout = 'Linear',
): Shelf {
  return { shelfKind: 'Items', id, title, list, subtitle: null, layout, more, extras: {} };
}

export function categoriesShelf(id: string, title: string, list: readonly ShelfCategory[], layout: ShelfLayout): Shelf {
  return { shelfKind: 'Categories', id, title, list, subtitle: null, layout, more: null, extras: {} };
}

/** Single media item in a feed page. */
export function itemShelf(media: EchoMediaItem): Shelf {
  return { shelfKind: 'Item', media };
}

export function categoryShelf(category: ShelfCategory): Shelf {
  return { shelfKind: 'Category', ...category };
}

export function folderCategory(id: string, title: string, feed: Feed<Shelf>): ShelfCategory {
  return { id, title, feed, subtitle: null, image: null, backgroundColor: null, extras: {} };
}

/** True when another page exists (Kotlin: currentPage * pageSize < totalCount). */
export function hasMorePages(pagination: Pagination): boolean {
  return pagination.currentPage * pagination.pageSize < pagination.totalCount;
}

/**
 * Feed of shelves loaded one page at a time. The continuation holds the last page loaded.
 * `firstPage` is the page used when there is no continuation (2 for the home "more" feeds, which
 * start after the first page; 1 everywhere else). Kotlin's home feeds started again at page 1.
 */
export function continuousShelfFeed<R extends { pagination: Pagination }>(
  fetchPage: (page: number) => Promise<R>,
  toShelves: (response: R) => Shelf[],
  firstPage = 1,
): Feed<Shelf> {
  const paged = PagedData.continuous<Shelf>(async (continuation) => {
    const lastLoaded = continuation === null ? firstPage - 1 : parseContinuation(continuation);
    const response = await fetchPage(lastLoaded + 1);
    return {
      data: toShelves(response),
      continuation: hasMorePages(response.pagination) ? String(lastLoaded + 1) : null,
    };
  });
  return feedOfPaged(paged);
}

function parseContinuation(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) ? n : 0;
}
