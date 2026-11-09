import type { OpenedFeed, ViewContext } from '../models/presentation.js';
import type { Json } from '../models/json.js';
import { imageView, extrasView } from './common.js';
import { mediaView } from './media.view.js';

/** FeedDto. A null feed (the extension returned nothing) is the empty feed. */
export function feedView(feed: OpenedFeed | null, ctx: ViewContext): Json {
  if (feed === null) {
    return {
      feedId: null,
      pagedId: null,
      tabs: [],
      selectedTab: null,
      showSearch: true,
      showSort: true,
      showPlayAndShuffle: false,
      background: null,
      customTracks: null,
    };
  }
  return {
    feedId: feed.feedId,
    pagedId: feed.pagedId,
    tabs: feed.tabs.map((t) => ({ id: t.id, title: t.title, isSort: t.isSort, extras: extrasView(t.extras) })),
    selectedTab: feed.selectedTab,
    showSearch: feed.showSearch,
    showSort: feed.showSort,
    showPlayAndShuffle: feed.showPlayAndShuffle,
    background: imageView(feed.background, ctx.issueUrl),
    customTracks: feed.customTracks ? feed.customTracks.map((t) => mediaView(t, ctx.issueUrl)) : null,
  };
}
