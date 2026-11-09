import type { QuickSearchItem } from '../models/echo/quick-search.js';
import type { Json } from '../models/json.js';
import { MODEL, NO_REGISTRATION, extrasView } from './common.js';
import { mediaView } from './media.view.js';

/** Quick-search items. The media inside is not registered (the Kotlin server did not either). */
export function quickSearchView(items: readonly QuickSearchItem[]): Json {
  return items.map((item): Json =>
    item.kind === 'Query'
      ? {
          quickSearchItemType: `${MODEL}QuickSearchItem.Query`,
          query: item.query,
          searched: item.searched,
          extras: extrasView(item.extras),
        }
      : {
          quickSearchItemType: `${MODEL}QuickSearchItem.Media`,
          media: mediaView(item.media, NO_REGISTRATION),
          searched: item.searched,
        },
  );
}
