import type { Feed } from '../models/feed.js';
import type { PagedData } from '../models/paged-data.js';
import type { SourceId } from '../models/source.js';
import type { SourceRouter } from '../extension/source-router.js';
import type { OpenedFeed, PageItem } from '../models/presentation.js';
import type { ExpiringRegistry } from '../stores/expiring-registry.js';
import type { Page } from '../models/paged-data.js';
import type { QuickSearchItem } from '../models/echo/quick-search.js';

/**
 * Opens feeds and pages them. Feed and page ids are opaque and expire after 30 minutes idle.
 * Port of the Kotlin Feeds.kt.
 */
export class FeedService {
  constructor(
    private readonly ext: SourceRouter,
    private readonly feeds: ExpiringRegistry<Feed<unknown>>,
    private readonly pages: ExpiringRegistry<PagedData<unknown>>,
  ) {}

  quickSearch(query: string, source: SourceId): Promise<QuickSearchItem[]> {
    return this.ext.forSource(source).quickSearch(query);
  }

  home(source: SourceId): Promise<OpenedFeed> {
    return this.ext.forSource(source).loadHomeFeed().then((feed) => this.openNew(feed));
  }

  library(): Promise<OpenedFeed> {
    return this.ext.loadLibraryFeed().then((feed) => this.openNew(feed));
  }

  search(query: string, source: SourceId): Promise<OpenedFeed> {
    return this.ext.forSource(source).loadSearchFeed(query).then((feed) => this.openNew(feed));
  }

  /** Opens a feed that was registered earlier (optionally at a tab). Null when it has expired. */
  async openExisting(feedId: string, tab: string | null): Promise<OpenedFeed | null> {
    const feed = this.feeds.get(feedId);
    if (feed === undefined) return null;
    return this.openFeed(feed, feedId, tab);
  }

  /** Opens a freshly loaded feed: registers it, then opens its first (or chosen) tab. */
  async openNew<T>(feed: Feed<T>): Promise<OpenedFeed> {
    const feedId = this.feeds.put(feed);
    return this.openFeed(feed, feedId, null);
  }

  /** Next page of a paged list. Null when the paged id has expired. */
  async loadPage(pagedId: string, continuation: string | null): Promise<Page<PageItem> | null> {
    const paged = this.pages.get(pagedId);
    if (paged === undefined) return null;
    const page = await paged.loadPage(continuation);
    return { data: page.data as readonly PageItem[], continuation: page.continuation };
  }

  private async openFeed<T>(feed: Feed<T>, feedId: string, tabId: string | null): Promise<OpenedFeed> {
    const tabs = feed.notSortTabs;
    const tab = (tabId === null ? undefined : tabs.find((t) => t.id === tabId)) ?? tabs[0] ?? null;
    const data = await feed.getPagedData(tab);
    const pagedId = this.pages.put(data.pagedData);
    const buttons = data.buttons;
    return {
      feedId,
      pagedId,
      tabs,
      selectedTab: tab?.id ?? null,
      showSearch: buttons?.showSearch ?? true,
      showSort: buttons?.showSort ?? true,
      showPlayAndShuffle: buttons?.showPlayAndShuffle ?? false,
      background: data.background,
      customTracks: buttons?.customTrackList ?? null,
    };
  }
}
