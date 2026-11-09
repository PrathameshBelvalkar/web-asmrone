/**
 * Media items of the Echo `common` slice, with Kotlin constructor defaults applied by the
 * factory functions. Kotlin `background: ImageHolder? = cover` means: when `background` is not
 * supplied it takes the value of `cover`. Factories reproduce that with `undefined` checks.
 */
import type { EchoDate, Extras, ImageHolder } from './common.js';
import type { Streamable } from './streamable.js';

export type AlbumType = 'PreRelease' | 'Single' | 'EP' | 'LP' | 'Compilation' | 'Show' | 'Book';
export type TrackType = 'Song' | 'Podcast' | 'VideoSong' | 'Video' | 'HorizontalVideo';

export interface Artist {
  readonly kind: 'Artist';
  readonly id: string;
  readonly name: string;
  readonly cover: ImageHolder | null;
  readonly bio: string | null;
  readonly background: ImageHolder | null;
  readonly banners: readonly ImageHolder[];
  readonly subtitle: string | null;
  readonly extras: Extras;
  readonly isRadioSupported: boolean;
  readonly isFollowable: boolean;
  readonly isSaveable: boolean;
  readonly isLikeable: boolean;
  readonly isHideable: boolean;
  readonly isShareable: boolean;
}

export interface Album {
  readonly kind: 'Album';
  readonly id: string;
  readonly title: string;
  readonly type: AlbumType | null;
  readonly cover: ImageHolder | null;
  readonly artists: readonly Artist[];
  readonly trackCount: number | null;
  readonly duration: number | null;
  readonly releaseDate: EchoDate | null;
  readonly description: string | null;
  readonly background: ImageHolder | null;
  readonly label: string | null;
  readonly isExplicit: boolean;
  readonly subtitle: string | null;
  readonly extras: Extras;
  readonly isRadioSupported: boolean;
  readonly isFollowable: boolean;
  readonly isSaveable: boolean;
  readonly isLikeable: boolean;
  readonly isHideable: boolean;
  readonly isShareable: boolean;
}

export interface Playlist {
  readonly kind: 'Playlist';
  readonly id: string;
  readonly title: string;
  readonly isEditable: boolean;
  readonly isPrivate: boolean;
  readonly cover: ImageHolder | null;
  readonly authors: readonly Artist[];
  readonly trackCount: number | null;
  readonly duration: number | null;
  readonly creationDate: EchoDate | null;
  readonly description: string | null;
  readonly background: ImageHolder | null;
  readonly subtitle: string | null;
  readonly extras: Extras;
  readonly isRadioSupported: boolean;
  readonly isFollowable: boolean;
  readonly isSaveable: boolean;
  readonly isLikeable: boolean;
  readonly isHideable: boolean;
  readonly isShareable: boolean;
}

/** Radio: Kotlin sets isRadioSupported = false and background = null in the body (not serialised). */
export interface Radio {
  readonly kind: 'Radio';
  readonly id: string;
  readonly title: string;
  readonly cover: ImageHolder | null;
  readonly authors: readonly Artist[];
  readonly trackCount: number | null;
  readonly description: string | null;
  readonly subtitle: string | null;
  readonly extras: Extras;
  readonly isFollowable: boolean;
  readonly isSaveable: boolean;
  readonly isLikeable: boolean;
  readonly isHideable: boolean;
  readonly isShareable: boolean;
}

export type Playable =
  | { readonly kind: 'Yes' }
  | { readonly kind: 'RegionLocked' }
  | { readonly kind: 'Unreleased' }
  | { readonly kind: 'No'; readonly reason: string };

export interface Track {
  readonly kind: 'Track';
  readonly id: string;
  readonly title: string;
  readonly type: TrackType;
  readonly cover: ImageHolder | null;
  readonly artists: readonly Artist[];
  readonly album: Album | null;
  readonly duration: number | null;
  readonly playedDuration: number | null;
  readonly plays: number | null;
  readonly releaseDate: EchoDate | null;
  readonly description: string | null;
  readonly background: ImageHolder | null;
  readonly genres: readonly string[];
  readonly isrc: string | null;
  readonly albumOrderNumber: number | null;
  readonly albumDiscNumber: number | null;
  readonly playlistAddedDate: EchoDate | null;
  readonly isExplicit: boolean;
  readonly subtitle: string | null;
  readonly extras: Extras;
  readonly isPlayable: Playable;
  readonly streamables: readonly Streamable[];
  readonly isRadioSupported: boolean;
  readonly isFollowable: boolean;
  readonly isSaveable: boolean;
  readonly isLikeable: boolean;
  readonly isHideable: boolean;
  readonly isShareable: boolean;
}

export type EchoMediaItem = Track | Album | Artist | Playlist | Radio;

/** Lists-like items (Album, Playlist, Radio) expose artists and trackCount. */
export type MediaList = Album | Playlist | Radio;

// ---------- factories (Kotlin defaults) ----------

type Optional<T> = T | undefined;
const or = <T>(value: Optional<T>, fallback: T): T => (value === undefined ? fallback : value);

export type ArtistInput = { id: string; name: string } & Partial<Omit<Artist, 'kind' | 'id' | 'name' | 'background'>> & { background?: ImageHolder | null };

export function makeArtist(i: ArtistInput): Artist {
  const cover = or(i.cover, null);
  return {
    kind: 'Artist',
    id: i.id,
    name: i.name,
    cover,
    bio: or(i.bio, null),
    background: or(i.background, cover),
    banners: or(i.banners, []),
    subtitle: or(i.subtitle, null),
    extras: or(i.extras, {}),
    isRadioSupported: or(i.isRadioSupported, true),
    isFollowable: or(i.isFollowable, true),
    isSaveable: or(i.isSaveable, true),
    isLikeable: or(i.isLikeable, false),
    isHideable: or(i.isHideable, false),
    isShareable: or(i.isShareable, true),
  };
}

export type AlbumInput = { id: string; title: string } & Partial<Omit<Album, 'kind' | 'id' | 'title' | 'background'>> & { background?: ImageHolder | null };

export function makeAlbum(i: AlbumInput): Album {
  const cover = or(i.cover, null);
  return {
    kind: 'Album',
    id: i.id,
    title: i.title,
    type: or(i.type, null),
    cover,
    artists: or(i.artists, []),
    trackCount: or(i.trackCount, null),
    duration: or(i.duration, null),
    releaseDate: or(i.releaseDate, null),
    description: or(i.description, null),
    background: or(i.background, cover),
    label: or(i.label, null),
    isExplicit: or(i.isExplicit, false),
    subtitle: or(i.subtitle, null),
    extras: or(i.extras, {}),
    isRadioSupported: or(i.isRadioSupported, true),
    isFollowable: or(i.isFollowable, false),
    isSaveable: or(i.isSaveable, true),
    isLikeable: or(i.isLikeable, false),
    isHideable: or(i.isHideable, false),
    isShareable: or(i.isShareable, true),
  };
}

export type PlaylistInput = { id: string; title: string; isEditable: boolean } & Partial<Omit<Playlist, 'kind' | 'id' | 'title' | 'isEditable' | 'background'>> & { background?: ImageHolder | null };

export function makePlaylist(i: PlaylistInput): Playlist {
  const cover = or(i.cover, null);
  return {
    kind: 'Playlist',
    id: i.id,
    title: i.title,
    isEditable: i.isEditable,
    isPrivate: or(i.isPrivate, true),
    cover,
    authors: or(i.authors, []),
    trackCount: or(i.trackCount, null),
    duration: or(i.duration, null),
    creationDate: or(i.creationDate, null),
    description: or(i.description, null),
    background: or(i.background, cover),
    subtitle: or(i.subtitle, null),
    extras: or(i.extras, {}),
    isRadioSupported: or(i.isRadioSupported, true),
    isFollowable: or(i.isFollowable, false),
    isSaveable: or(i.isSaveable, true),
    isLikeable: or(i.isLikeable, false),
    isHideable: or(i.isHideable, false),
    isShareable: or(i.isShareable, true),
  };
}

export type RadioInput = { id: string; title: string } & Partial<Omit<Radio, 'kind' | 'id' | 'title'>>;

export function makeRadio(i: RadioInput): Radio {
  return {
    kind: 'Radio',
    id: i.id,
    title: i.title,
    cover: or(i.cover, null),
    authors: or(i.authors, []),
    trackCount: or(i.trackCount, null),
    description: or(i.description, null),
    subtitle: or(i.subtitle, null),
    extras: or(i.extras, {}),
    isFollowable: or(i.isFollowable, false),
    isSaveable: or(i.isSaveable, false),
    isLikeable: or(i.isLikeable, false),
    isHideable: or(i.isHideable, false),
    isShareable: or(i.isShareable, true),
  };
}

export type TrackInput = { id: string; title: string } & Partial<Omit<Track, 'kind' | 'id' | 'title' | 'background'>> & { background?: ImageHolder | null };

export function makeTrack(i: TrackInput): Track {
  const cover = or(i.cover, null);
  return {
    kind: 'Track',
    id: i.id,
    title: i.title,
    type: or(i.type, 'Song'),
    cover,
    artists: or(i.artists, []),
    album: or(i.album, null),
    duration: or(i.duration, null),
    playedDuration: or(i.playedDuration, null),
    plays: or(i.plays, null),
    releaseDate: or(i.releaseDate, null),
    description: or(i.description, null),
    background: or(i.background, cover),
    genres: or(i.genres, []),
    isrc: or(i.isrc, null),
    albumOrderNumber: or(i.albumOrderNumber, null),
    albumDiscNumber: or(i.albumDiscNumber, null),
    playlistAddedDate: or(i.playlistAddedDate, null),
    isExplicit: or(i.isExplicit, false),
    subtitle: or(i.subtitle, null),
    extras: or(i.extras, {}),
    isPlayable: or(i.isPlayable, { kind: 'Yes' }),
    streamables: or(i.streamables, []),
    isRadioSupported: or(i.isRadioSupported, true),
    isFollowable: or(i.isFollowable, false),
    isSaveable: or(i.isSaveable, true),
    isLikeable: or(i.isLikeable, true),
    isHideable: or(i.isHideable, true),
    isShareable: or(i.isShareable, true),
  };
}

/** Servers are the streamables of type Server (Track.servers in Kotlin). */
export function serversOf(track: Track): readonly Streamable[] {
  return track.streamables.filter((s) => s.type === 'Server');
}

// ---------- computed properties (Kotlin body properties, which kotlinx still serialises) ----------

/** Kotlin Long.toDurationString(): "mm:ss", or "hh:mm:ss" from one hour. Input is milliseconds. */
export function durationString(ms: number): string {
  const seconds = Math.trunc(ms / 1000);
  const minutes = Math.trunc(seconds / 60);
  const hours = Math.trunc(minutes / 60);
  const pad = (n: number): string => String(n).padStart(2, '0');
  const head = hours > 0 ? `${pad(hours)}:` : '';
  return `${head}${pad(minutes % 60)}:${pad(seconds % 60)}`.trim();
}

/** Kotlin `subtitle ?: buildString { artist names }.trim().ifBlank { null }`. */
export function albumSubtitleWithOutE(album: Album): string | null {
  if (album.subtitle !== null) return album.subtitle;
  return blankToNull(album.artists.map((a) => a.name).join(', '));
}

/** Kotlin Track.subtitleWithOutE: the subtitle, else "duration • artists". */
export function trackSubtitleWithOutE(track: Track): string | null {
  if (track.subtitle !== null) return track.subtitle;
  const parts: string[] = [];
  if (track.duration !== null) parts.push(durationString(track.duration));
  const artists = track.artists.map((a) => a.name).join(', ');
  if (artists.trim().length > 0) {
    if (track.duration !== null) parts.push(' • ');
    parts.push(artists);
  }
  return blankToNull(parts.join('').trim());
}

/** Kotlin Track.subtitleWithE: a 🅴 prefix when explicit, then subtitleWithOutE. */
export function trackSubtitleWithE(track: Track): string | null {
  const explicit = track.isExplicit ? '🅴 ' : '';
  return blankToNull(`${explicit}${trackSubtitleWithOutE(track) ?? ''}`.trim());
}

function blankToNull(value: string): string | null {
  return value.trim().length === 0 ? null : value.trim();
}
