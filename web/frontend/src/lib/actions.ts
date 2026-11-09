import type { NavigateFunction } from 'react-router-dom';
import { pagesOptions, radioOptions, shareOptions } from '../api/queries';
import type { FeedDto, FeedEntry, MediaItem, Track } from '../api/types';
import { playQueue, queueNext } from '../player/engine';
import { queryClient } from './queryClient';
import { artistStub, kindOf, remember, routeFor } from './media';
import { messageFor } from './errors';
import { toast } from './toast';
import type { Artist } from '../api/types';

/** Open a media item, remembering the objects that later pages need. */
export function openMedia(item: MediaItem, navigate: NavigateFunction): void {
  const route = routeFor(item);
  if (!route) {
    toast('This item cannot be opened.');
    return;
  }
  const kind = kindOf(item);
  if (kind === 'Artist' || kind === 'Playlist') remember(item);
  navigate(route);
}

export function isTrackEntry(entry: FeedEntry): entry is Track {
  return 'mediaItemType' in entry && kindOf(entry) === 'Track';
}

/** Tracks inside one feed entry (a track, a shelf item, or a shelf's track list). */
export function tracksIn(entry: FeedEntry): Track[] {
  if ('mediaItemType' in entry) return isTrackEntry(entry) ? [entry] : [];
  if (entry.kind === 'item' && entry.item && isTrackEntry(entry.item)) return [entry.item];
  if (entry.kind === 'tracks' || entry.kind === 'items') {
    return (entry.items ?? []).filter(isTrackEntry);
  }
  return [];
}

/** Every track in a feed. Pages come from the query cache, so already-loaded pages aren't fetched again. */
export async function collectTracks(feed: FeedDto): Promise<Track[]> {
  if (!feed.pagedId) return feed.customTracks ?? [];
  const pages = await queryClient.fetchInfiniteQuery({ ...pagesOptions(feed.pagedId), pages: 60 });
  return pages.pages.flatMap((page) => page.items.flatMap(tracksIn));
}

export async function playFeed(feed: FeedDto): Promise<void> {
  try {
    const tracks = await collectTracks(feed);
    if (!tracks.length) return toast('No tracks to play here.');
    playQueue(tracks, 0);
  } catch (e) {
    toast(messageFor(e));
  }
}

export async function startRadio(item: MediaItem): Promise<void> {
  try {
    const { feed } = await queryClient.fetchQuery(radioOptions(item));
    const tracks = await collectTracks(feed);
    if (!tracks.length) return toast('The radio has no tracks.');
    playQueue(tracks, 0);
  } catch (e) {
    toast(messageFor(e));
  }
}

export function playTrackNext(track: Track): void {
  queueNext([track]);
  toast('Added to play next.');
}

export async function shareItem(item: MediaItem): Promise<void> {
  try {
    const { url } = await queryClient.fetchQuery(shareOptions(item));
    await navigator.clipboard.writeText(url);
    toast('Link copied.');
  } catch (e) {
    toast(messageFor(e));
  }
}

/** Artists are remembered so the artist page can load them by name. */
export function artistLinkFor(artist: Artist): string {
  remember(artistStub(artist));
  return `/artist/${encodeURIComponent(artist.id)}`;
}
