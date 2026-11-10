import { imageFromUrl, type ImageHolder } from '../../models/echo/common.js';
import {
  makeAlbum,
  makeArtist,
  makeTrack,
  type Album,
  type Artist,
  type Track,
} from '../../models/echo/media.js';
import { serverStreamable, type Streamable } from '../../models/echo/streamable.js';
import { actorArtistId, categoryArtistId, streamId, trackId, workAlbumId } from './constants.js';
import type { HasmrCard } from './parsers/listing.js';
import type { HasmrWork } from './parsers/work.js';
import type { NamedLink } from './parsers/common.js';

/** Covers come from the site's own image addresses, which are open (no headers needed). */
const cover = (url: string | null): ImageHolder | null => (url ? imageFromUrl(url) : null);

export function cardToAlbum(card: HasmrCard, title: string): Album {
  return makeAlbum({
    id: workAlbumId(card.slug),
    title,
    cover: cover(card.cover),
    artists: [],
    subtitle: null,
    releaseDate: null,
    duration: card.durationSec === null ? null : card.durationSec * 1000,
    extras: { slug: card.slug, originalTitle: card.title },
    isLikeable: false,
    isRadioSupported: false,
    isFollowable: false,
    isShareable: true,
  });
}

/** The circle is the category with the circle's name; the cast is the work's voice actors. */
export function workArtists(work: HasmrWork): Artist[] {
  const circle = work.circle?.toLowerCase();
  const circleLink = work.categories.find((c: NamedLink) => c.name.toLowerCase() === circle);
  const artists: Artist[] = [];
  if (circleLink && work.circle)
    artists.push(makeArtist({ id: categoryArtistId(circleLink.slug), name: work.circle }));
  for (const actor of work.actors)
    artists.push(makeArtist({ id: actorArtistId(actor.slug), name: actor.name }));
  return artists;
}

export function workToAlbum(
  work: HasmrWork,
  slug: string,
  title: string,
  originalTitle: string,
): Album {
  return makeAlbum({
    id: workAlbumId(slug),
    title,
    cover: cover(work.cover),
    artists: workArtists(work),
    subtitle: work.voices.length > 0 ? work.voices.join(', ') : null,
    releaseDate: null,
    trackCount: Math.max(1, work.tracks.length),
    duration: work.durationSec === null ? null : work.durationSec * 1000,
    extras: { slug, originalTitle, ...(work.postId ? { postId: work.postId } : {}) },
    isLikeable: false,
    isRadioSupported: false,
    isFollowable: false,
    isShareable: true,
  });
}

/** One track per MP3. Each file is a whole track, so no offsets are needed. */
export function workToTracks(work: HasmrWork, album: Album, slug: string): Track[] {
  return work.tracks.map((track) => {
    const streamables: Streamable[] = [serverStreamable(streamId(track.url), 0)];
    return makeTrack({
      id: trackId(slug, track.number),
      title: `Track ${track.number}`,
      cover: album.cover,
      album,
      artists: album.artists,
      duration: null,
      streamables,
      isPlayable: { kind: 'Yes' },
      extras: { number: String(track.number) },
      isRadioSupported: false,
      isLikeable: false,
      isHideable: false,
    });
  });
}
