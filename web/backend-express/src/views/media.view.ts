import type { Album, Artist, EchoMediaItem, Playable, Playlist, Radio, Track } from '../models/echo/media.js';
import type { Streamable } from '../models/echo/streamable.js';
import type { Json } from '../models/json.js';
import { MODEL, NO_REGISTRATION, dateView, extrasView, imageView, type Registrar } from './common.js';

/**
 * Media items as the frontend reads them. `issue` registers the item's own images for the proxy.
 * Nested objects (artists inside an album, the album inside a track) never register anything,
 * matching the Kotlin server.
 */
export function mediaView(item: EchoMediaItem, issue: Registrar): Json {
  switch (item.kind) {
    case 'Track':
      return trackView(item, issue);
    case 'Album':
      return albumView(item, issue, true);
    case 'Artist':
      return artistView(item, issue, true);
    case 'Playlist':
      return playlistView(item, issue);
    case 'Radio':
      return radioView(item, issue);
  }
}

function trackView(t: Track, issue: Registrar): Json {
  const cover = imageView(t.cover, issue);
  return {
    mediaItemType: `${MODEL}Track`,
    id: t.id,
    title: t.title,
    type: t.type,
    cover,
    artists: t.artists.map(artistNested),
    album: t.album ? albumView(t.album, NO_REGISTRATION, false) : null,
    duration: t.duration,
    playedDuration: t.playedDuration,
    plays: t.plays,
    releaseDate: dateView(t.releaseDate),
    description: t.description,
    background: imageView(t.background, issue),
    genres: [...t.genres],
    isrc: t.isrc,
    albumOrderNumber: t.albumOrderNumber,
    albumDiscNumber: t.albumDiscNumber,
    playlistAddedDate: dateView(t.playlistAddedDate),
    isExplicit: t.isExplicit,
    subtitle: t.subtitle,
    extras: extrasView(t.extras),
    isPlayable: playableView(t.isPlayable),
    streamables: t.streamables.map(streamableView),
    isRadioSupported: t.isRadioSupported,
    isFollowable: t.isFollowable,
    isSaveable: t.isSaveable,
    isLikeable: t.isLikeable,
    isHideable: t.isHideable,
    isShareable: t.isShareable,
  };
}

function albumView(a: Album, issue: Registrar, top: boolean): Json {
  return {
    ...(top ? { mediaItemType: `${MODEL}Album` } : {}),
    id: a.id,
    title: a.title,
    type: a.type,
    cover: imageView(a.cover, issue),
    artists: a.artists.map(artistNested),
    trackCount: a.trackCount,
    duration: a.duration,
    releaseDate: dateView(a.releaseDate),
    description: a.description,
    background: imageView(a.background, issue),
    label: a.label,
    isExplicit: a.isExplicit,
    subtitle: a.subtitle,
    extras: extrasView(a.extras),
    isRadioSupported: a.isRadioSupported,
    isFollowable: a.isFollowable,
    isSaveable: a.isSaveable,
    isLikeable: a.isLikeable,
    isHideable: a.isHideable,
    isShareable: a.isShareable,
  };
}

function artistView(a: Artist, issue: Registrar, top: boolean): Json {
  return {
    ...(top ? { mediaItemType: `${MODEL}Artist` } : {}),
    id: a.id,
    name: a.name,
    cover: imageView(a.cover, issue),
    bio: a.bio,
    background: imageView(a.background, issue),
    banners: a.banners.map((b) => imageView(b, NO_REGISTRATION)),
    subtitle: a.subtitle,
    extras: extrasView(a.extras),
    isRadioSupported: a.isRadioSupported,
    isFollowable: a.isFollowable,
    isSaveable: a.isSaveable,
    isLikeable: a.isLikeable,
    isHideable: a.isHideable,
    isShareable: a.isShareable,
  };
}

/** Artist nested inside another object (no discriminator, no registration). */
export function artistNested(a: Artist): Json {
  return artistView(a, NO_REGISTRATION, false);
}

function playlistView(p: Playlist, issue: Registrar): Json {
  return {
    mediaItemType: `${MODEL}Playlist`,
    id: p.id,
    title: p.title,
    isEditable: p.isEditable,
    isPrivate: p.isPrivate,
    cover: imageView(p.cover, issue),
    authors: p.authors.map(artistNested),
    trackCount: p.trackCount,
    duration: p.duration,
    creationDate: dateView(p.creationDate),
    description: p.description,
    background: imageView(p.background, issue),
    subtitle: p.subtitle,
    extras: extrasView(p.extras),
    isRadioSupported: p.isRadioSupported,
    isFollowable: p.isFollowable,
    isSaveable: p.isSaveable,
    isLikeable: p.isLikeable,
    isHideable: p.isHideable,
    isShareable: p.isShareable,
  };
}

/** Radio does not serialise `background` or `isRadioSupported` (they are body properties in Kotlin). */
function radioView(r: Radio, issue: Registrar): Json {
  return {
    mediaItemType: `${MODEL}Radio`,
    id: r.id,
    title: r.title,
    cover: imageView(r.cover, issue),
    authors: r.authors.map(artistNested),
    trackCount: r.trackCount,
    description: r.description,
    subtitle: r.subtitle,
    extras: extrasView(r.extras),
    isFollowable: r.isFollowable,
    isSaveable: r.isSaveable,
    isLikeable: r.isLikeable,
    isHideable: r.isHideable,
    isShareable: r.isShareable,
  };
}

function playableView(p: Playable): Json {
  switch (p.kind) {
    case 'Yes':
    case 'RegionLocked':
    case 'Unreleased':
      return { type: `${MODEL}Track.Playable.${p.kind}` };
    case 'No':
      return { type: `${MODEL}Track.Playable.No`, reason: p.reason };
  }
}

/** Kotlin Artist.title is its name; every other item has a title field. */
export function titleOf(item: EchoMediaItem): string {
  return item.kind === 'Artist' ? item.name : item.title;
}

export function streamableView(s: Streamable): Json {
  return { id: s.id, quality: s.quality, type: s.type, title: s.title, extras: extrasView(s.extras) };
}
