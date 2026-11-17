import type { Json } from '../models/json.js';
import type {
  HanimeCard,
  HanimeChange,
  HanimeDetails,
  HanimeList,
  HanimeRef,
  HanimeSeasons,
  HanimeShelf,
  HanimeStatus,
  HanimeStream,
  HanimeSuggestion,
  HanimeTagGroup,
  HanimeTitle,
} from '../models/hanime.js';

type JsonObject = { [key: string]: Json };

export const hanimeRefView = (ref: HanimeRef): JsonObject => ({
  slug: ref.slug,
  name: ref.name,
  count: ref.count ?? null,
});

export function hanimeCardView(card: HanimeCard): JsonObject {
  return {
    id: card.id,
    slug: card.slug,
    name: card.name,
    poster: card.poster,
    cover: card.cover,
    studio: { slug: card.studio.slug, name: card.studio.name },
    releasedAt: card.releasedAt,
    uploadedAt: card.uploadedAt,
    views: card.views,
    likes: card.likes,
    censorship: card.censorship,
    episode: card.episode,
    isNew: card.isNew,
  };
}

export function hanimeListView(list: HanimeList<HanimeCard>): JsonObject {
  return {
    items: list.items.map(hanimeCardView),
    page: list.page,
    lastPage: list.lastPage,
    total: list.total,
    hasMore: list.hasMore,
  };
}

export function hanimeTitleView(t: HanimeTitle): JsonObject {
  return {
    ...hanimeCardView(t),
    altTitles: [...t.altTitles],
    description: [...t.description],
    tags: t.tags.map((ref) => ({ slug: ref.slug, name: ref.name })),
    dislikes: t.dislikes,
    downloads: t.downloads,
    rating: t.rating,
    series: t.series === null ? null : { key: t.series.key, name: t.series.name },
    episodes: t.episodes.map(hanimeCardView),
    similar: t.similar.map(hanimeCardView),
    siteUrl: t.siteUrl,
  };
}

export const hanimeHomeView = (shelves: readonly HanimeShelf[]): Json =>
  shelves.map((s) => ({
    key: s.key,
    title: s.title,
    browse: { ...s.browse },
    items: s.items.map(hanimeCardView),
  }));

export const hanimeTagsView = (groups: readonly HanimeTagGroup[]): Json =>
  groups.map((g) => ({
    group: g.group,
    tags: g.tags.map((t) => ({ ...hanimeRefView(t), description: t.description, image: t.image })),
  }));

export const hanimeDetailsView = (d: HanimeDetails): JsonObject => ({
  durationSec: d.durationSec,
  badges: [...d.badges],
  altNames: [...d.altNames],
  synopsis: [...d.synopsis],
  storyboard:
    d.storyboard === null
      ? null
      : {
          url: d.storyboard.url,
          columns: d.storyboard.columns,
          rows: d.storyboard.rows,
          tiles: d.storyboard.tiles,
        },
});

export const hanimeSeasonsView = (s: HanimeSeasons): JsonObject => ({
  years: [...s.years],
  year: s.year,
  seasons: s.seasons.map((x) => ({ season: x.season, items: x.items.map(hanimeCardView) })),
});

export const hanimeRefsView = (refs: readonly HanimeRef[]): Json => refs.map(hanimeRefView);

export function hanimeSuggestView(list: readonly HanimeSuggestion[]): Json {
  return list.map((s): JsonObject => {
    switch (s.type) {
      case 'title':
        return { type: 'title', card: hanimeCardView(s.card) };
      case 'series':
        return { type: 'series', key: s.key, name: s.name, count: s.count, poster: s.poster };
      case 'tag':
        return { type: 'tag', ref: hanimeRefView(s.ref) };
      case 'studio':
        return { type: 'studio', ref: hanimeRefView(s.ref) };
    }
  });
}

export const hanimeChangesView = (changes: readonly HanimeChange[]): Json =>
  changes.map((c) => ({
    at: c.at,
    kind: c.kind,
    id: c.id,
    slug: c.slug,
    name: c.name,
    poster: c.poster,
    fields: c.fields === undefined ? null : [...c.fields],
  }));

export const hanimeStatusView = (s: HanimeStatus): JsonObject => ({
  titles: s.titles,
  lastCheckedAt: s.lastCheckedAt,
  lastChangedAt: s.lastChangedAt,
  syncing: s.syncing,
  paused: s.paused,
  error: s.error,
});

export const hanimeStreamView = (s: HanimeStream): JsonObject => ({
  file: s.file,
  page: s.page,
  title: s.title,
});
