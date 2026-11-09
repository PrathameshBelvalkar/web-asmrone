import {
  albumSubtitleWithOutE,
  trackSubtitleWithE,
  trackSubtitleWithOutE,
  type Album,
  type Artist,
  type EchoMediaItem,
  type Playable,
  type Playlist,
  type Radio,
  type Track,
} from '../models/echo/media.js';
import type { Streamable } from '../models/echo/streamable.js';
import type { Json } from '../models/json.js';
import { MODEL, NO_REGISTRATION, dateView, extrasView, imageView, type Registrar } from './common.js';

/**
 * Media items as the frontend reads them. `issue` registers the item's own images for the proxy.
 * Nested objects (artists inside an album, the album inside a track) never register anything,
 * matching the Kotlin server. The computed fields (title, date, subtitle...) are emitted because
 * kotlinx serialises the Kotlin body properties too.
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
  return {
    mediaItemType: `${MODEL}Track`,
    id: t.id,
    title: t.title,
    type: t.type,
    cover: imageView(t.cover, issue),
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
    subtitleWithOutE: trackSubtitleWithOutE(t),
    subtitleWithE: trackSubtitleWithE(t),
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
    date: dateView(a.releaseDate),
    subtitleWithOutE: albumSubtitleWithOutE(a),
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
    title: a.name,
    description: a.bio,
    subtitleWithOutE: a.subtitle,
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
    artists: p.authors.map(artistNested),
    date: dateView(p.creationDate),
  };
}

/** Radio: `background` and `isRadioSupported` are body properties in Kotlin, so they are fixed values here. */
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
    artists: r.authors.map(artistNested),
    background: null,
    isRadioSupported: false,
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

export function streamableView(s: Streamable): Json {
  return { id: s.id, quality: s.quality, type: s.type, title: s.title, extras: extrasView(s.extras) };
}

/** Kotlin Artist.title is its name; every other item has a title field. */
export function titleOf(item: EchoMediaItem): string {
  return item.kind === 'Artist' ? item.name : item.title;
}
