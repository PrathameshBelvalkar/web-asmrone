import type { ImageHolder } from './echo/common.js';
import type { Tab } from './echo/common.js';
import type { Track } from './echo/media.js';
import type { PagedData } from './paged-data.js';

export interface FeedButtons {
  readonly showSearch: boolean;
  readonly showSort: boolean;
  readonly showPlayAndShuffle: boolean;
  readonly customTrackList: readonly Track[] | null;
}

export const FEED_BUTTONS_EMPTY: FeedButtons = {
  showSearch: false,
  showSort: false,
  showPlayAndShuffle: false,
  customTrackList: null,
};

export interface FeedData<T> {
  readonly pagedData: PagedData<T>;
  readonly buttons: FeedButtons | null;
  readonly background: ImageHolder | null;
}

/** A feed: optional tabs, and a loader that returns paged data for the selected tab. */
export class Feed<T> {
  readonly notSortTabs: readonly Tab[];

  constructor(
    readonly tabs: readonly Tab[],
    readonly getPagedData: (tab: Tab | null) => Promise<FeedData<T>>,
  ) {
    this.notSortTabs = tabs.filter((t) => !t.isSort);
  }

  /** Paged data of the first non-sort tab (or the single unnamed source). */
  async pagedDataOfFirst(): Promise<PagedData<T>> {
    return (await this.getPagedData(this.notSortTabs[0] ?? null)).pagedData;
  }

  /** Every item from every non-sort tab. */
  async loadAll(): Promise<T[]> {
    if (this.tabs.length === 0) return (await this.pagedDataOfFirst()).loadAll();
    const lists: T[][] = [];
    for (const tab of this.notSortTabs) {
      lists.push(await (await this.getPagedData(tab)).pagedData.loadAll());
    }
    return lists.flat();
  }
}

/** Feed with no tabs, backed by one paged source. */
export function feedOfPaged<T>(
  pagedData: PagedData<T>,
  buttons: FeedButtons | null = null,
  background: ImageHolder | null = null,
): Feed<T> {
  return new Feed<T>([], () => Promise.resolve({ pagedData, buttons, background }));
}
