import { imageFromUrl, type ImageHolder } from '../../models/echo/common.js';
import { makeAlbum, makeArtist, makeTrack, type Album, type Artist, type EchoMediaItem, type Track } from '../../models/echo/media.js';
import { serverStreamable, type Streamable } from '../../models/echo/streamable.js';
import type { Shelf, ShelfCategory } from '../../models/echo/shelf.js';
import type { Feed } from '../../models/feed.js';
import { JASMR_REFERER, artistId, chapterTrackId, streamId, workAlbumId } from './constants.js';
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

export function postToAlbum(post: Post): Album {
  return makeAlbum({
    id: workAlbumId(post.workId),
    title: post.title,
    cover: coverImage(post.cover),
    artists: circleArtists(post.circle, post.categories),
    subtitle: post.cv.length > 0 ? post.cv.join(', ') : null,
    description: post.description,
    trackCount: Math.max(1, post.chapters.length),
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
export function postToTracks(post: Post, album: Album): Track[] {
  const streamables: Streamable[] = post.streamUrl === null ? [] : [serverStreamable(streamId(post.streamUrl), 0)];
  const isPlayable =
    post.streamUrl === null ? { kind: 'No' as const, reason: 'No stream was found for this work' } : { kind: 'Yes' as const };

  if (post.chapters.length === 0) {
    return [
      makeTrack({
        id: chapterTrackId(post.workId, 0),
        title: post.title,
        cover: album.cover,
        album,
        artists: album.artists,
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
    const extras: Record<string, string> = { start: String(chapter.start), chapter: String(chapter.index) };
    if (next !== undefined) extras.end = String(next.start);
    return makeTrack({
      id: chapterTrackId(post.workId, chapter.index),
      title: chapter.title,
      cover: album.cover,
      album,
      artists: album.artists,
      duration: next !== undefined ? next.start - chapter.start : null,
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
export function browseCategory(id: string, title: string, feed: Feed<Shelf>): ShelfCategory {
  return { id, title, feed, subtitle: null, image: null, backgroundColor: null, extras: {} };
}

export function itemShelf(media: EchoMediaItem): Shelf {
  return { shelfKind: 'Item', media };
}

export function itemsShelf(id: string, title: string, list: readonly EchoMediaItem[], more: Feed<Shelf> | null = null): Shelf {
  return { shelfKind: 'Items', id, title, list, subtitle: null, layout: 'Linear', more, extras: {} };
}

export function categoriesShelf(id: string, title: string, list: readonly ShelfCategory[]): Shelf {
  return { shelfKind: 'Categories', id, title, list, subtitle: null, layout: 'Linear', more: null, extras: {} };
}
