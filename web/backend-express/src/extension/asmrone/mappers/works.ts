import { dateFromYmd, imageFromUrl, type EchoDate } from '../../../models/echo/common.js';
import { makeAlbum, makeArtist, makePlaylist, makeTrack, type Album, type Playlist, type Track } from '../../../models/echo/media.js';
import { serverStreamable } from '../../../models/echo/streamable.js';
import type { AsmrPlaylist, Work } from '../api/upstream.schemas.js';
import { kotlinDoubleToString } from '../util/text.js';

/** Pending like state per work id (set when the user likes or unlikes, consumed on next mapping). */
export type PendingLikes = Map<number, 'LIKE' | 'UNLIKE'>;

/** Parses "yyyy-MM-dd" or "yyyy-MM-dd HH:mm:ss" (or ISO with "T") into a date value. */
export function parseDate(text: string): EchoDate {
  const match = /^(\d{1,4})-(\d{1,2})-(\d{1,2})/.exec(text.trim());
  if (!match) throw new Error(`Invalid date: ${text}`);
  return dateFromYmd(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function createDescription(work: Work): string {
  const tags = work.tags.map((t) => t.i18n['en-us'].name ?? t.name).join(', ');
  return (
    `Tags: ${tags}\n` +
    `Full Title: ${work.title}\n` +
    `Downloads: ${work.dl_count}, Price: ${work.price}, Reviews: ${work.review_count}, ` +
    `Rating: ${kotlinDoubleToString(work.rate_average_2dp)}\n`
  );
}

/** Work → Album. Removes any pending like for the work (Kotlin Work.toAlbum). */
export function workToAlbum(work: Work, pendingLikes: PendingLikes): Album {
  pendingLikes.delete(work.id);
  let stars = '';
  if (work.userRating !== null && work.userRating !== undefined) {
    stars += '★'.repeat(work.userRating) + '☆'.repeat(5 - work.userRating);
  }
  return makeAlbum({
    id: String(work.id),
    title: work.title,
    subtitle: stars.length > 0 ? stars : work.name,
    trackCount: 0,
    isLikeable: true,
    isRadioSupported: true,
    isShareable: true,
    isSaveable: true,
    cover: imageFromUrl(work.mainCoverUrl, {}, true),
    artists: work.vas.map((v) => makeArtist({ id: v.id, name: v.name })),
    releaseDate: parseDate(work.release),
    description: createDescription(work),
    isExplicit: work.nsfw,
    extras: { isLiked: String((work.userRating ?? 0) > 3) },
  });
}

/** Work → placeholder track for playlist contents. Deleting from a playlist needs the album id. */
export function workToFakeTrack(work: Work): Track {
  return makeTrack({
    id: String(work.id),
    title: work.title,
    album: workToAlbum(work, new Map()),
    artists: work.vas.map((v) => makeArtist({ id: v.id, name: v.name })),
    cover: imageFromUrl(work.mainCoverUrl, {}, true),
    duration: 0,
    isExplicit: work.nsfw,
    releaseDate: parseDate(work.release),
    isPlayable: { kind: 'No', reason: 'Album Required' },
    isRadioSupported: false,
    isShareable: false,
    isLikeable: false,
    isSaveable: false,
    streamables: [serverStreamable('OPEN_ALBUM', 1)],
  });
}

const SYS_PLAYLIST_NAMES: Readonly<Record<string, string>> = {
  __SYS_PLAYLIST_MARKED: 'Marked',
  __SYS_PLAYLIST_LIKED: 'Liked',
};

export function asmrPlaylistToPlaylist(p: AsmrPlaylist): Playlist {
  return makePlaylist({
    id: p.id,
    title: SYS_PLAYLIST_NAMES[p.name] ?? p.name,
    cover: imageFromUrl(p.mainCoverUrl, {}, true),
    description: p.description,
    creationDate: parseDate(p.created_at),
    isPrivate: p.privacy === 0,
    trackCount: p.works_count,
    isEditable: true,
  });
}
