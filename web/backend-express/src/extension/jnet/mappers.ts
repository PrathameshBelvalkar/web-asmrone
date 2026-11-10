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
import { JNET_SITE, circleArtistId, streamId, trackId, workAlbumId } from './constants.js';
import type { Localized, Video, WorkSummary, WorkTag } from './api/schemas.js';

/** Site language field for each Translation Language code. */
const FIELD: Record<string, keyof Localized> = {
  en: 'english',
  ja: 'japanese',
  zh: 'chinese',
  ko: 'korean',
  es: 'spanish',
};

/** A tolerance for rounding: the sum of track lengths may differ from the file's length by a few seconds. */
const TRACK_SUM_TOLERANCE_SEC = 5;

export interface PickedText {
  /** The text to show. */
  readonly text: string;
  /** True when it is Japanese (or another language the site doesn't provide) and should be translated. */
  readonly needsTranslation: boolean;
}

/**
 * The text to show for a localized field. The site's own translation for the chosen language is used
 * first. Without one, English, and then Japanese (which is translated when the target isn't Japanese).
 */
export function pickText(value: Localized | null | undefined, languageCode: string): PickedText {
  const english = clean(value?.english);
  const japanese = clean(value?.japanese);
  const own = FIELD[languageCode];
  if (own !== undefined) {
    const chosen = clean(value?.[own]);
    if (chosen) return { text: chosen, needsTranslation: false };
    if (english) return { text: english, needsTranslation: false };
    return { text: japanese, needsTranslation: languageCode !== 'ja' && japanese.length > 0 };
  }
  // A language the site doesn't provide: translate the English (or Japanese) text.
  const source = english || japanese;
  return { text: source, needsTranslation: source.length > 0 };
}

/** Descriptions are markdown: drop heading marks and blank lines, keep the line breaks. */
export function plainDescription(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^#{1,6}\s*/, '').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

/** A duration as seconds: a number is already seconds; text is "1:48:03" or "12:05". */
export function durationSeconds(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  return parseSeconds(value);
}

/** "1:48:03" or "12:05" → seconds, or null. */
export function parseSeconds(text: string | null | undefined): number | null {
  if (!text) return null;
  const parts = text.split(':').map((p) => Number(p));
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !Number.isFinite(p) || p < 0))
    return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function coverFrom(path: string | null | undefined): ImageHolder | null {
  return path ? imageFromUrl(new URL(path, JNET_SITE).href) : null;
}

export function circleArtists(
  circle: { romaji?: unknown; kana?: unknown } | null | undefined,
): Artist[] {
  const name = clean(circle?.romaji) || clean(circle?.kana);
  if (!name) return [];
  return [makeArtist({ id: circleArtistId(name), name })];
}

/** Up to four tag names, most useful first, as the album subtitle. */
export function tagLine(tags: readonly WorkTag[] | null | undefined): string | null {
  const names = (tags ?? [])
    .map((tag) => clean(tag.english) || clean(tag.japanese))
    .filter((name) => name.length > 0)
    .slice(0, 4);
  return names.length > 0 ? names.join(' · ') : null;
}

interface AlbumText {
  /** The title shown (already localized). */
  readonly title: string;
  /** The Japanese title, kept for search. */
  readonly originalTitle: string;
}

/** A work from a list (search, home, related) as an album. */
export function summaryToAlbum(work: WorkSummary, text: AlbumText): Album {
  return makeAlbum({
    id: workAlbumId(work.rjCode),
    title: text.title,
    cover: coverFrom(work.image),
    artists: circleArtists(work.circle),
    subtitle: tagLine(work.tags),
    releaseDate: null,
    duration: secondsToMs(durationSeconds(work.duration)),
    extras: {
      rjCode: work.rjCode,
      subtitled: String(work.subtitled ?? false),
      originalTitle: text.originalTitle,
    },
    isLikeable: false,
    isRadioSupported: false,
    isFollowable: false,
    isShareable: true,
  });
}

/** A full work as an album, with its description and track count. */
export function videoToAlbum(video: Video, text: AlbumText, description: string | null): Album {
  return makeAlbum({
    id: workAlbumId(video.rjCode),
    title: text.title,
    cover: coverFrom(video.thumbnail),
    artists: circleArtists(video.circle),
    subtitle: tagLine(video.tags),
    description,
    releaseDate: null,
    trackCount: Math.max(1, video.tracks?.length ?? 1),
    duration: secondsToMs(parseSeconds(video.duration)),
    extras: {
      rjCode: video.rjCode,
      subtitled: String(video.subtitled ?? false),
      originalTitle: text.originalTitle,
    },
    isLikeable: false,
    isRadioSupported: false,
    isFollowable: false,
    isShareable: true,
  });
}

/**
 * The tracks of a work. All of them play from the work's one audio file, so each track starts at
 * the sum of the lengths before it (`extras.start`, `extras.end`, in seconds). When those lengths
 * don't add up to the file's length, the file is treated as one track instead of guessing offsets.
 */
export function videoToTracks(video: Video, album: Album, trackTitles: readonly string[]): Track[] {
  const totalSec = parseSeconds(video.duration);
  const list = video.tracks ?? [];
  const sum = list.reduce((total, track) => total + track.length, 0);
  const streamables: Streamable[] = video.source
    ? [serverStreamable(streamId(new URL(video.source, JNET_SITE).href), 0)]
    : [];
  const consistent =
    list.length > 0 &&
    totalSec !== null &&
    list.every((track) => track.length > 0) &&
    Math.abs(sum - totalSec) <= TRACK_SUM_TOLERANCE_SEC;

  const base = {
    cover: album.cover,
    album,
    artists: album.artists,
    streamables,
    isPlayable: { kind: 'Yes' as const },
    isRadioSupported: false,
    isLikeable: false,
    isHideable: false,
  };

  if (!consistent) {
    return [
      makeTrack({
        ...base,
        id: trackId(video.rjCode, 0),
        title: album.title,
        duration: secondsToMs(totalSec),
        extras: { start: '0', chapter: '0' },
      }),
    ];
  }

  let offset = 0;
  return list.map((track, index) => {
    const start = offset;
    offset += track.length;
    const end = Math.min(offset, totalSec);
    return makeTrack({
      ...base,
      id: trackId(video.rjCode, index),
      title: trackTitles[index] || `Track ${index + 1}`,
      duration: secondsToMs(track.length),
      extras: { start: String(start), end: String(end), chapter: String(index) },
    });
  });
}

export function secondsToMs(seconds: number | null): number | null {
  return seconds !== null && seconds > 0 ? Math.round(seconds * 1000) : null;
}

/** The trimmed text, or '' for anything that isn't a string. */
function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
