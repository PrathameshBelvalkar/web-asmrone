import type { Json } from '../models/json.js';
import type { MangaCard, MangaGallery, MangaIndex, MangaList, MangaTag } from '../models/manga.js';

/** A card for the client. Tag ids are only for the content rules, so they stay on the server. */
function cardView(card: MangaCard): Json {
  return {
    id: card.id,
    title: card.title,
    language: card.language,
    cover: card.cover,
    coverFallbacks: [...card.coverFallbacks],
    aspect: card.aspect,
  };
}

function tagView(tag: MangaTag): Json {
  return { kind: tag.kind, slug: tag.slug, name: tag.name, count: tag.count };
}

export function mangaListView(list: MangaList): Json {
  return {
    tag: list.tag === null ? null : tagView(list.tag),
    items: list.items.map(cardView),
    page: list.page,
    lastPage: list.lastPage,
    hasMore: list.hasMore,
  };
}

export function mangaIndexView(index: MangaIndex): Json {
  return { items: index.items.map(tagView), page: index.page, lastPage: index.lastPage };
}

export function mangaTagsView(tags: readonly MangaTag[]): Json {
  return { items: tags.map(tagView) };
}

export function mangaGalleryView(gallery: MangaGallery): Json {
  return {
    id: gallery.id,
    title: gallery.title,
    titleJapanese: gallery.titleJapanese,
    prettyTitle: gallery.prettyTitle,
    cover: gallery.cover,
    pages: gallery.pages.map((p) => ({ n: p.n, url: p.url, thumb: p.thumb, width: p.width, height: p.height })),
    tags: gallery.tags.map(tagView),
    uploadedAt: gallery.uploadedAt,
    scanlator: gallery.scanlator,
  };
}
