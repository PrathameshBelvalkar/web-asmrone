import { feedOfPaged, type Feed } from '../../../models/feed.js';
import { PagedData } from '../../../models/paged-data.js';
import type { Shelf, ShelfCategory } from '../../../models/echo/shelf.js';
import type { Tag, WorksResponse } from '../api/upstream.schemas.js';
import { categoriesShelf, continuousShelfFeed, folderCategory, itemShelf, itemsShelf } from '../mappers/shelves.js';
import { asmrPlaylistToPlaylist, workToAlbum } from '../mappers/works.js';
import { SLOW_SHELF_TIMEOUT_MS, shelfOrNull, withTimeoutOrNull, type ExtensionContext } from './context.js';

const DEFAULT_SHELVES = ['Popular', 'Recommended', 'All'] as const;

/** Home, library and search feeds, and the tag shelves they show. */
export class HomeFeature {
  constructor(private readonly ctx: ExtensionContext) {}

  loadHomeFeed(): Feed<Shelf> {
    return feedOfPaged(
      PagedData.single<Shelf>(async () => {
        const showTags = [...(this.ctx.settings()?.getStringSet('showTags') ?? [])];

        const defaults = DEFAULT_SHELVES.map((title) =>
          shelfOrNull(() => withTimeoutOrNull(SLOW_SHELF_TIMEOUT_MS, () => this.defaultShelf(title))),
        );
        const tagsShelf = shelfOrNull(() => this.tagsShelf());
        const tagShelves = showTags.map((name) =>
          shelfOrNull(() => withTimeoutOrNull(SLOW_SHELF_TIMEOUT_MS, () => this.homeTagShelf(name))),
        );

        const results = await Promise.all([...defaults, ...tagShelves, tagsShelf]);
        return results.filter((s): s is Shelf => s !== null);
      }),
    );
  }

  loadLibraryFeed(): Feed<Shelf> {
    return feedOfPaged(
      PagedData.single<Shelf>(() => Promise.all([this.playlistsShelf(), this.favoritesShelf()])),
    );
  }

  loadSearchFeed(query: string): Feed<Shelf> {
    return feedOfPaged(
      PagedData.continuous<Shelf>(async (continuation) => {
        const last = parseContinuation(continuation);
        const response = await this.ctx.api.searchWorks(last + 1, query);
        return this.albumPage(response, last);
      }),
    );
  }

  private async defaultShelf(title: (typeof DEFAULT_SHELVES)[number]): Promise<Shelf> {
    const fetch = (page: number): Promise<WorksResponse> => this.defaultShelfPage(title, page);
    const response = await fetch(1);
    const albums = response.works.map((w) => workToAlbum(w, this.ctx.pendingLikes));
    const more =
      response.pagination.currentPage * response.pagination.pageSize < response.pagination.totalCount
        ? continuousShelfFeed(fetch, (r) => r.works.map((w) => itemShelf(workToAlbum(w, this.ctx.pendingLikes))), 2)
        : null;
    return itemsShelf(title.toLowerCase(), title, albums, more);
  }

  private defaultShelfPage(title: (typeof DEFAULT_SHELVES)[number], page: number): Promise<WorksResponse> {
    switch (title) {
      case 'Popular':
        return this.ctx.api.getPopularWorks(page);
      case 'Recommended':
        return this.ctx.api.getRecommendedWorks(page);
      case 'All':
        return this.ctx.api.getWorks(page);
    }
  }

  /** Tag shelf on the home page, found by English or raw tag name. */
  private async homeTagShelf(name: string): Promise<Shelf | null> {
    const tags = await this.ctx.api.getTags();
    const tag = tags.find((t) => t.i18n['en-us'].name === name || t.name === name);
    if (!tag) return null;
    return this.tagFeedShelf(tag);
  }

  private async tagFeedShelf(tag: Tag): Promise<Shelf> {
    const label = tag.i18n['en-us'].name ?? tag.name;
    const keyword = `$tag:${label}$`;
    const fetch = (page: number): Promise<WorksResponse> => this.ctx.api.searchWorks(page, keyword);
    const response = await fetch(1);
    const albums = response.works.map((w) => workToAlbum(w, this.ctx.pendingLikes));
    const more =
      response.pagination.currentPage * response.pagination.pageSize < response.pagination.totalCount
        ? continuousShelfFeed(fetch, (r) => r.works.map((w) => itemShelf(workToAlbum(w, this.ctx.pendingLikes))), 2)
        : null;
    return itemsShelf(`tag_${tag.id}`, label, albums, more);
  }

  /** "Tags" grid on the home page: one category per tag, each opening a tag search. */
  async tagsShelf(): Promise<Shelf> {
    const tags = await this.ctx.api.getTags();
    return categoriesShelf('tags', 'Tags', tags.map((t) => this.tagCategory(t)), 'Grid');
  }

  private tagCategory(tag: Tag): ShelfCategory {
    const label = tag.i18n['en-us'].name ?? tag.name;
    const keyword = `$tag:${label}$`;
    const feed = continuousShelfFeed((page) => this.ctx.api.searchWorks(page, keyword), (r) =>
      r.works.map((w) => itemShelf(workToAlbum(w, this.ctx.pendingLikes))),
    );
    return folderCategory(String(tag.id), label, feed);
  }

  private async playlistsShelf(): Promise<Shelf> {
    const first = await this.ctx.api.getPlaylists();
    const playlists = first.playlists.map(asmrPlaylistToPlaylist);
    const more =
      first.pagination.currentPage * first.pagination.pageSize < first.pagination.totalCount
        ? continuousShelfFeed(
            (page) => this.ctx.api.getPlaylists(page),
            (r) => r.playlists.map((p) => itemShelf(asmrPlaylistToPlaylist(p))),
          )
        : null;
    return itemsShelf('playlists', 'Playlists', playlists, more, 'Linear');
  }

  private async favoritesShelf(): Promise<Shelf> {
    const first = await this.ctx.api.getFavorites();
    const albums = first.works.map((w) => workToAlbum(w, this.ctx.pendingLikes));
    const more =
      first.pagination.currentPage * first.pagination.pageSize < first.pagination.totalCount
        ? continuousShelfFeed(
            (page) => this.ctx.api.getFavorites(page),
            (r) => r.works.map((w) => itemShelf(workToAlbum(w, this.ctx.pendingLikes))),
          )
        : null;
    return itemsShelf('favorites', 'Favorites', albums, more);
  }

  private albumPage(response: WorksResponse, last: number): { data: Shelf[]; continuation: string | null } {
    const data = response.works.map((w) => itemShelf(workToAlbum(w, this.ctx.pendingLikes)));
    const more = response.pagination.currentPage * response.pagination.pageSize < response.pagination.totalCount;
    return { data, continuation: more ? String(last + 1) : null };
  }
}

function parseContinuation(value: string | null): number {
  if (value === null) return 0;
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) ? n : 0;
}
