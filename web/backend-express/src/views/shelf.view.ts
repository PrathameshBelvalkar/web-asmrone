import type { Shelf, ShelfCategory } from '../models/echo/shelf.js';
import type { ViewContext } from '../models/presentation.js';
import type { Json } from '../models/json.js';
import { imageView } from './common.js';
import { mediaView, titleOf } from './media.view.js';

/** A shelf as the feed screens read it. Each kind fills only its own fields; the rest stay null. */
export function shelfView(shelf: Shelf, ctx: ViewContext): Json {
  const empty = { subtitle: null, horizontal: true, moreFeedId: null, items: null, item: null, categories: null, category: null };
  switch (shelf.shelfKind) {
    case 'Items':
      return {
        kind: 'items',
        id: shelf.id,
        title: shelf.title,
        ...empty,
        subtitle: shelf.subtitle,
        horizontal: shelf.layout === 'Linear',
        moreFeedId: shelf.more ? ctx.registerFeed(shelf.more) : null,
        items: shelf.list.map((m) => mediaView(m, ctx.issueUrl)),
      };
    case 'Tracks':
      return {
        kind: 'tracks',
        id: shelf.id,
        title: shelf.title,
        ...empty,
        subtitle: shelf.subtitle,
        horizontal: shelf.layout === 'Linear',
        moreFeedId: shelf.more ? ctx.registerFeed(shelf.more) : null,
        items: shelf.list.map((m) => mediaView(m, ctx.issueUrl)),
      };
    case 'Categories':
      return {
        kind: 'categories',
        id: shelf.id,
        title: shelf.title,
        ...empty,
        subtitle: shelf.subtitle,
        horizontal: shelf.layout === 'Linear',
        moreFeedId: shelf.more ? ctx.registerFeed(shelf.more) : null,
        categories: shelf.list.map((c) => categoryView(c, ctx)),
      };
    case 'Item':
      return {
        kind: 'item',
        id: shelf.media.id,
        title: titleOf(shelf.media),
        ...empty,
        item: mediaView(shelf.media, ctx.issueUrl),
      };
    case 'Category':
      return { kind: 'category', id: shelf.id, title: shelf.title, ...empty, category: categoryView(shelf, ctx) };
  }
}

export function categoryView(category: ShelfCategory, ctx: ViewContext): Json {
  return {
    id: category.id,
    title: category.title,
    subtitle: category.subtitle,
    image: imageView(category.image, ctx.issueUrl),
    backgroundColor: category.backgroundColor,
    feedId: category.feed ? ctx.registerFeed(category.feed) : null,
  };
}
