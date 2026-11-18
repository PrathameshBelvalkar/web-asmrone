import { create } from 'zustand';
import type { ImageHolder, MangaGallery, Track } from '../api/types';
import { artistsOf, titleOf } from './media';

/**
 * What you listened to, read and watched, newest first. One entry per work, gallery and movie:
 * listening to another track of a work, turning a page, or watching on moves that entry to the top.
 * Kept in this browser.
 */

export interface ListenEntry {
  kind: 'asmr';
  /** The work id (opens `/work/{id}`). */
  id: string;
  title: string;
  artists: string;
  cover: ImageHolder | null;
  /** The track last played in the work. */
  trackTitle: string;
  at: number;
}

export interface ReadEntry {
  kind: 'manga';
  /** The gallery id. */
  id: string;
  title: string;
  cover: string;
  coverFallbacks: string[];
  /** The page you were last on, and how many the gallery has. */
  page: number;
  pages: number;
  at: number;
}

export interface WatchEntry {
  kind: 'jav';
  /** `{censored|uncensored}/{slug}`. */
  id: string;
  movieKind: string;
  slug: string;
  dvdId: string | null;
  title: string;
  /** The landscape cover. */
  cover: string | null;
  /** Seconds watched and the movie's length, in seconds. */
  position: number;
  duration: number;
  at: number;
}

export interface HentaiEntry {
  kind: 'hanime';
  /** The title's slug (opens `/hentai/title/{slug}`). */
  id: string;
  title: string;
  /** The portrait poster. */
  cover: string | null;
  /** Seconds watched and the episode's length, in seconds. */
  position: number;
  duration: number;
  at: number;
}

export type HistoryEntry = ListenEntry | ReadEntry | WatchEntry | HentaiEntry;

const KEY = 'echo:history';
/** Per kind. */
const LIMIT = 300;

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? (data as HistoryEntry[]).filter((e) => e && (e.kind === 'asmr' || e.kind === 'manga' || e.kind === 'jav' || e.kind === 'hanime')) : [];
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable: history lasts for this visit only */
  }
}

interface HistoryState {
  readonly entries: HistoryEntry[];
}

export const useHistory = create<HistoryState>(() => ({ entries: load() }));

useHistory.subscribe((state, prev) => {
  if (state.entries !== prev.entries) save(state.entries);
});

/** Puts [entry] at the top, replacing any older entry for the same item, and trims to the limit. */
function push(entry: HistoryEntry): void {
  const rest = useHistory.getState().entries.filter((e) => !(e.kind === entry.kind && e.id === entry.id));
  let sameKind = 1;
  const kept = rest.filter((e) => e.kind !== entry.kind || ++sameKind <= LIMIT);
  useHistory.setState({ entries: [entry, ...kept] });
}

/** The work a track belongs to, or null when it can't be told. */
export function workIdOf(track: Track): string | null {
  const fromExtras = track.extras?.id;
  if (typeof fromExtras === 'string' && fromExtras) return fromExtras;
  if (track.album?.id) return track.album.id;
  return track.streamables?.[0]?.id === 'OPEN_ALBUM' ? track.id : null;
}

/** Records that [track] started playing. */
export function recordListen(track: Track, now = Date.now()): void {
  const id = workIdOf(track);
  if (!id) return;
  const album = track.album;
  push({
    kind: 'asmr',
    id,
    title: album?.title?.trim() ? titleOf(album) : titleOf(track),
    artists: album?.artists?.length ? artistsOf(album) : artistsOf(track),
    cover: album?.cover ?? track.cover ?? null,
    trackTitle: titleOf(track),
    at: now,
  });
}

/** Records that [page] of gallery [g] is open. */
export function recordRead(g: MangaGallery, page: number, now = Date.now()): void {
  push({
    kind: 'manga',
    id: g.id,
    title: g.prettyTitle?.trim() || g.title,
    cover: g.cover,
    coverFallbacks: g.coverFallbacks ?? [],
    page,
    pages: g.pages.length,
    at: now,
  });
}

/** The movie being watched, as the player records it. */
export interface WatchedMovie {
  kind: string;
  slug: string;
  dvdId: string | null;
  title: string;
  cover: string | null;
}

export const watchId = (kind: string, slug: string) => `${kind}/${slug}`;

/** Records how far into [movie] you are. */
export function recordWatch(movie: WatchedMovie, position: number, duration: number, now = Date.now()): void {
  push({
    kind: 'jav',
    id: watchId(movie.kind, movie.slug),
    movieKind: movie.kind,
    slug: movie.slug,
    dvdId: movie.dvdId,
    title: movie.title,
    cover: movie.cover,
    position: Math.max(0, Math.floor(position)),
    duration: Math.max(0, Math.floor(duration)),
    at: now,
  });
}

/** The hentai title being watched, as the player records it. */
export interface WatchedTitle {
  slug: string;
  title: string;
  cover: string | null;
}

/** Records how far into hentai [t] you are. */
export function recordHentaiWatch(t: WatchedTitle, position: number, duration: number, now = Date.now()): void {
  push({
    kind: 'hanime',
    id: t.slug,
    title: t.title,
    cover: t.cover,
    position: Math.max(0, Math.floor(position)),
    duration: Math.max(0, Math.floor(duration)),
    at: now,
  });
}

/** Within the last two minutes (or 5%) counts as watched to the end. */
export function isFinished(e: Pick<WatchEntry, 'position' | 'duration'>): boolean {
  return e.duration > 0 && (e.position >= e.duration - 120 || e.position >= e.duration * 0.95);
}

/** Where to pick a movie up again, in seconds; null when it's barely started or finished. */
export function resumeAt(e: Pick<WatchEntry, 'position' | 'duration'> | undefined): number | null {
  if (!e || e.position < 30 || isFinished(e)) return null;
  return e.position;
}

/** The watch entry for a movie, kept up to date. */
export function useWatchEntry(kind: string, slug: string): WatchEntry | undefined {
  const id = watchId(kind, slug);
  return useHistory((s) => s.entries.find((e): e is WatchEntry => e.kind === 'jav' && e.id === id));
}

/** The watch entry for a hentai title, kept up to date. */
export function useHentaiEntry(slug: string): HentaiEntry | undefined {
  return useHistory((s) => s.entries.find((e): e is HentaiEntry => e.kind === 'hanime' && e.id === slug));
}

export function removeEntry(kind: HistoryEntry['kind'], id: string): void {
  useHistory.setState({ entries: useHistory.getState().entries.filter((e) => !(e.kind === kind && e.id === id)) });
}

/** Clears one kind, or everything. */
export function clearHistory(kind?: HistoryEntry['kind']): void {
  useHistory.setState({ entries: kind ? useHistory.getState().entries.filter((e) => e.kind !== kind) : [] });
}
