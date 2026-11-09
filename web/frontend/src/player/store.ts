import { create } from 'zustand';
import type { Track } from '../api/types';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  queue: Track[];
  index: number;
  playing: boolean;
  loading: boolean;
  position: number; // seconds
  duration: number; // seconds
  volume: number; // 0..1
  shuffle: boolean;
  repeat: RepeatMode;
  error: string | null;
  nowPlayingOpen: boolean;
  nowPlayingTab: 'lyrics' | 'queue';
  setState: (partial: Partial<PlayerState>) => void;
}

const QUEUE_KEY = 'echo:queue';
const SETTINGS_KEY = 'echo:player';

function loadQueue(): { queue: Track[]; index: number } {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { queue: Track[]; index: number };
      return { queue: parsed.queue ?? [], index: parsed.index ?? -1 };
    }
  } catch {
    /* ignore broken storage */
  }
  return { queue: [], index: -1 };
}

function loadPrefs(): { volume: number; shuffle: boolean; repeat: RepeatMode } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { volume: 1, shuffle: false, repeat: 'off', ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { volume: 1, shuffle: false, repeat: 'off' };
}

const saved = loadQueue();
const prefs = loadPrefs();

export const usePlayer = create<PlayerState>((set) => ({
  queue: saved.queue,
  index: saved.index,
  playing: false,
  loading: false,
  position: 0,
  duration: 0,
  volume: prefs.volume,
  shuffle: prefs.shuffle,
  repeat: prefs.repeat,
  error: null,
  nowPlayingOpen: false,
  nowPlayingTab: 'lyrics',
  setState: (partial) => set(partial),
}));

/** Persist queue and preferences. Storage failures are ignored. */
usePlayer.subscribe((state, prev) => {
  if (state.queue !== prev.queue || state.index !== prev.index) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify({ queue: state.queue, index: state.index }));
    } catch {
      /* ignore */
    }
  }
  if (state.volume !== prev.volume || state.shuffle !== prev.shuffle || state.repeat !== prev.repeat) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ volume: state.volume, shuffle: state.shuffle, repeat: state.repeat }));
    } catch {
      /* ignore */
    }
  }
});
