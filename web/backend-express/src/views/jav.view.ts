import type { Json } from '../models/json.js';
import type {
  JavGenreGroup,
  JavIdol,
  JavIdolCard,
  JavList,
  JavMovie,
  JavMovieCard,
  JavMovieList,
  JavNewsItem,
  JavNewsPost,
  JavRef,
} from '../models/jav.js';

type JsonObject = { [key: string]: Json };

const refView = (ref: JavRef | null): Json =>
  ref === null ? null : { slug: ref.slug, name: ref.name };

function movieCardView(card: JavMovieCard): JsonObject {
  return {
    slug: card.slug,
    kind: card.kind,
    dvdId: card.dvdId,
    title: card.title,
    releaseDate: card.releaseDate,
    upcoming: card.upcoming,
    cover: card.cover,
    studio: refView(card.studio),
  };
}

function idolCardView(idol: JavIdolCard): JsonObject {
  return { slug: idol.slug, name: idol.name, photo: idol.photo, age: idol.age };
}

function listView<T>(list: JavList<T>, item: (value: T) => Json): JsonObject {
  return {
    items: list.items.map(item),
    page: list.page,
    lastPage: list.lastPage,
    hasMore: list.hasMore,
  };
}

export const javMovieListView = (list: JavMovieList): Json => ({
  heading: list.heading,
  ...listView(list, movieCardView),
});

export const javMovieCardsView = (list: JavList<JavMovieCard>): Json =>
  listView(list, movieCardView);

export const javIdolListView = (list: JavList<JavIdolCard>): Json => listView(list, idolCardView);

export function javMovieView(movie: JavMovie): Json {
  return {
    ...movieCardView(movie),
    contentId: movie.contentId,
    coverFull: movie.coverFull,
    runtimeMin: movie.runtimeMin,
    series: refView(movie.series),
    director: refView(movie.director),
    genres: movie.genres.map(refView),
    idols: movie.idols.map(idolCardView),
    samples: movie.samples.map((s) => ({ thumb: s.thumb, full: s.full })),
    trailer: movie.trailer,
    similar: movie.similar.map(movieCardView),
  };
}

export function javIdolView(idol: JavIdol): Json {
  return {
    ...idolCardView(idol),
    photoFull: idol.photoFull,
    nameJapanese: idol.nameJapanese,
    altNames: [...idol.altNames],
    dob: idol.dob,
    debut: idol.debut,
    debutAge: idol.debutAge,
    birthplace: idol.birthplace,
    sign: idol.sign,
    blood: idol.blood,
    measurements: idol.measurements,
    cup: idol.cup,
    heightCm: idol.heightCm,
    shoeSize: idol.shoeSize,
    hairLength: [...idol.hairLength],
    hairColor: [...idol.hairColor],
    tags: [...idol.tags],
    bio: idol.bio,
    censoredCount: idol.censoredCount,
    uncensoredCount: idol.uncensoredCount,
    movies: listView(idol.movies, movieCardView),
    related: idol.related.map(idolCardView),
  };
}

export function javGenresView(groups: readonly JavGenreGroup[]): Json {
  return { groups: groups.map((g) => ({ name: g.name, genres: g.genres.map(refView) })) };
}

function newsItemView(item: JavNewsItem): Json {
  return {
    path: item.path,
    url: item.url,
    title: item.title,
    date: item.date,
    categories: item.categories.map(refView),
    summary: item.summary,
    image: item.image,
  };
}

export const javNewsListView = (list: JavList<JavNewsItem>): Json => listView(list, newsItemView);

export function javNewsPostView(post: JavNewsPost): Json {
  return {
    path: post.path,
    url: post.url,
    title: post.title,
    date: post.date,
    intro: post.intro,
    ranked: post.ranked.map(
      (entry): Json =>
        entry.type === 'movie'
          ? { rank: entry.rank, type: 'movie', movie: movieCardView(entry.movie) }
          : { rank: entry.rank, type: 'idol', idol: idolCardView(entry.idol) },
    ),
  };
}
