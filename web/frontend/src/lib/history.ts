import { create } from 'zustand';
import type { ImageHolder, MangaGallery, Track } from '../api/types';
import { artistsOf, titleOf } from './media';

/**
 * What you listened to and read, newest first. One entry per work and per gallery: listening to
 * another track of a work, or turning a page, moves that entry to the top. Kept in this browser.
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

export type HistoryEntry = ListenEntry | ReadEntry;

const KEY = 'echo:history';
/** Per kind. */
const LIMIT = 300;

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? (data as HistoryEntry[]).filter((e) => e && (e.kind === 'asmr' || e.kind === 'manga')) : [];
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

export function removeEntry(kind: HistoryEntry['kind'], id: string): void {
  useHistory.setState({ entries: useHistory.getState().entries.filter((e) => !(e.kind === kind && e.id === id)) });
}

/** Clears one kind, or everything. */
export function clearHistory(kind?: HistoryEntry['kind']): void {
  useHistory.setState({ entries: kind ? useHistory.getState().entries.filter((e) => e.kind !== kind) : [] });
}
