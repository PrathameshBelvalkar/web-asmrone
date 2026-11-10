import { imageFromUrl, type ImageHolder } from '../../models/echo/common.js';
import {
  makeAlbum,
  makeArtist,
  makeTrack,
  type Album,
  type Artist,
  type EchoMediaItem,
  type Track,
} from '../../models/echo/media.js';
import { serverStreamable, type Streamable } from '../../models/echo/streamable.js';
import type { Shelf, ShelfCategory } from '../../models/echo/shelf.js';
import type { Feed } from '../../models/feed.js';
import { JASMR_REFERER, artistId, chapterTrackId, streamId, workAlbumId } from './constants.js';
import type { FeaturedWork } from './parsers/index-pages.js';
import type { Category, ListingCard } from './parsers/listing.js';
import type { Post } from './parsers/post.js';

/** Covers are only served to the site's own Referer, so every cover request carries it. */
const coverImage = (url: string | null): ImageHolder | null =>
  url === null ? null : imageFromUrl(url, { Referer: JASMR_REFERER });

/** The circle is the category whose name matches the circle label. */
function circleArtists(circle: string | null, categories: readonly Category[]): Artist[] {
  if (circle === null) return [];
  const match = categories.find((c) => c.name.toLowerCase() === circle.toLowerCase());
  if (match === undefined) return [];
  return [makeArtist({ id: artistId(match.slug), name: circle })];
}

export function cardToAlbum(card: ListingCard): Album {
  return makeAlbum({
    id: workAlbumId(card.workId),
    title: card.title,
    cover: coverImage(card.cover),
    artists: circleArtists(card.circle, card.categories),
    subtitle: card.cv.length > 0 ? card.cv.join(', ') : null,
    releaseDate: null,
    extras: card.rjCode === null ? {} : { rjCode: card.rjCode },
    isLikeable: false,
    isRadioSupported: false,
    isFollowable: false,
    isShareable: true,
  });
}

/**
 * A featured work. The site shows only its cover, so the title is the one already known from a
 * listing when there is one, otherwise the RJ code. Opening it loads the full work.
 */
export function featuredToAlbum(work: FeaturedWork, known: Album | undefined): Album {
  return makeAlbum({
    id: workAlbumId(work.workId),
    title: known?.title ?? work.rjCode ?? `Work ${work.workId}`,
    cover: coverImage(work.cover) ?? known?.cover ?? null,
    artists: known?.artists ?? [],
    subtitle: known?.subtitle ?? null,
    releaseDate: null,
    extras: work.rjCode === null ? {} : { rjCode: work.rjCode },
    isLikeable: false,
    isRadioSupported: false,
    isFollowable: false,
    isShareable: true,
  });
}

/** `totalSec` is the length of the work's stream when known (from its playlist). Durations are in ms. */
export function postToAlbum(post: Post, totalSec: number | null = null): Album {
  return makeAlbum({
    id: workAlbumId(post.workId),
    title: post.title,
    cover: coverImage(post.cover),
    artists: circleArtists(post.circle, post.categories),
    subtitle: post.cv.length > 0 ? post.cv.join(', ') : null,
    description: post.description,
    trackCount: Math.max(1, post.chapters.length),
    duration: totalSec !== null && totalSec > 0 ? Math.round(totalSec * 1000) : null,
    extras: post.rjCode === null ? {} : { rjCode: post.rjCode },
    isLikeable: false,
    isRadioSupported: false,
    isFollowable: false,
    isShareable: true,
  });
}

/**
 * Chapters of a work. Each chapter is a track that plays from its start offset in the work's one
 * stream. `extras.start` and `extras.end` are in seconds; the last chapter has no end. A work without
 * a chapter list becomes one track for the whole stream.
 */
/**
 * Chapters as tracks. Track durations are in milliseconds (the site gives seconds). The last
 * chapter's length, and its end, come from `totalSec` (the stream's length) when known.
 */
export function postToTracks(post: Post, album: Album, totalSec: number | null = null): Track[] {
  const streamables: Streamable[] =
    post.streamUrl === null ? [] : [serverStreamable(streamId(post.streamUrl), 0)];
  const isPlayable =
    post.streamUrl === null
      ? { kind: 'No' as const, reason: 'No stream was found for this work' }
      : { kind: 'Yes' as const };

  if (post.chapters.length === 0) {
    return [
      makeTrack({
        id: chapterTrackId(post.workId, 0),
        title: post.title,
        cover: album.cover,
        album,
        artists: album.artists,
        duration: totalSec !== null && totalSec > 0 ? Math.round(totalSec * 1000) : null,
        streamables,
        isPlayable,
        extras: { start: '0', chapter: '0' },
        isRadioSupported: false,
        isLikeable: false,
        isHideable: false,
      }),
    ];
  }

  return post.chapters.map((chapter, i) => {
    const next = post.chapters[i + 1];
    const extras: Record<string, string> = {
      start: String(chapter.start),
      chapter: String(chapter.index),
    };
    const end = next?.start ?? (totalSec !== null && totalSec > chapter.start ? totalSec : null);
    if (end !== null) extras.end = String(end);
    return makeTrack({
      id: chapterTrackId(post.workId, chapter.index),
      title: chapter.title,
      cover: album.cover,
      album,
      artists: album.artists,
      duration: end !== null ? Math.round((end - chapter.start) * 1000) : null,
      streamables,
      isPlayable,
      extras,
      isRadioSupported: false,
      isLikeable: false,
      isHideable: false,
    });
  });
}

/** A browse category (listing feed) as a shelf category. */
export function browseCategory(
  id: string,
  title: string,
  feed: Feed<Shelf>,
  subtitle: string | null = null,
): ShelfCategory {
  return { id, title, feed, subtitle, image: null, backgroundColor: null, extras: {} };
}

export function itemShelf(media: EchoMediaItem): Shelf {
  return { shelfKind: 'Item', media };
}

export function itemsShelf(
  id: string,
  title: string,
  list: readonly EchoMediaItem[],
  more: Feed<Shelf> | null = null,
): Shelf {
  return {
    shelfKind: 'Items',
    id,
    title,
    list,
    subtitle: null,
    layout: 'Linear',
    more,
    extras: {},
  };
}

export function categoriesShelf(
  id: string,
  title: string,
  list: readonly ShelfCategory[],
  subtitle: string | null = null,
): Shelf {
  return {
    shelfKind: 'Categories',
    id,
    title,
    list,
    subtitle,
    layout: 'Linear',
    more: null,
    extras: {},
  };
}
