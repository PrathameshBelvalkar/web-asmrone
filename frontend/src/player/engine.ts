import { proxyUrl } from '../api/client';
import { mediaOptions } from '../api/queries';
import { queryClient } from '../lib/queryClient';
import type { Track } from '../api/types';
import { artistsOf, imageUrl, titleOf } from '../lib/media';
import { usePlayer } from './store';

/**
 * One audio element for the whole app, so playback continues across pages.
 * Stream URLs come from the server; if the browser can't load one directly,
 * it is retried once through the server's media proxy.
 */
const audio = new Audio();
audio.preload = 'auto';

let token = 0;
let proxied = false;
const urlCache = new Map<string, string>();

async function resolveUrl(track: Track): Promise<string> {
  const cached = urlCache.get(track.id);
  if (cached) return cached;
  const media = await queryClient.fetchQuery(mediaOptions(track));
  const source = media.sources.find((s) => s.request?.url);
  if (!source?.request) throw new Error('This track has no playable stream.');
  urlCache.set(track.id, source.request.url);
  return source.request.url;
}

function setError(message: string | null) {
  usePlayer.getState().setState({ error: message });
}

export async function loadAndPlay(index: number): Promise<void> {
  const state = usePlayer.getState();
  const track = state.queue[index];
  if (!track) return;
  const myToken = ++token;
  proxied = false;
  state.setState({ index, loading: true, error: null, position: 0, duration: 0 });
  try {
    const url = await resolveUrl(track);
    if (myToken !== token) return;
    audio.src = url;
    updateSession(track);
    await audio.play();
  } catch (e) {
    if (myToken !== token) return;
    usePlayer.getState().setState({ loading: false, playing: false });
    setError(e instanceof Error ? e.message : 'Playback failed.');
  }
}

/** Start playing [tracks] from [index]. */
export function playQueue(tracks: Track[], index = 0): void {
  const playable = tracks.filter((t) => t.isPlayable?.type?.endsWith('.Yes') ?? true);
  if (!playable.length) {
    setError('Nothing in this list can be played.');
    return;
  }
  const start = Math.max(0, playable.findIndex((t) => t.id === tracks[index]?.id));
  usePlayer.getState().setState({ queue: playable, index: start });
  void loadAndPlay(start);
}

/** Add tracks after the current one, or start playing when the queue is empty. */
export function queueNext(tracks: Track[]): void {
  const state = usePlayer.getState();
  if (!state.queue.length || state.index < 0) return playQueue(tracks, 0);
  const queue = [...state.queue];
  queue.splice(state.index + 1, 0, ...tracks);
  state.setState({ queue });
}

export function togglePlay(): void {
  const state = usePlayer.getState();
  if (state.index < 0) return;
  if (audio.paused) {
    if (!audio.src) void loadAndPlay(state.index);
    else void audio.play().catch(() => setError('Playback was blocked. Press play again.'));
  } else {
    audio.pause();
  }
}

export function nextTrack(): void {
  const { queue, index, shuffle, repeat } = usePlayer.getState();
  if (!queue.length) return;
  if (repeat === 'one') {
    seek(0);
    void audio.play();
    return;
  }
  let target: number;
  if (shuffle && queue.length > 1) {
    do target = Math.floor(Math.random() * queue.length); while (target === index);
  } else if (index + 1 < queue.length) {
    target = index + 1;
  } else if (repeat === 'all') {
    target = 0;
  } else {
    usePlayer.getState().setState({ playing: false, position: 0 });
    audio.pause();
    return;
  }
  void loadAndPlay(target);
}

export function prevTrack(): void {
  const { index } = usePlayer.getState();
  if (audio.currentTime > 3 || index <= 0) {
    seek(0);
    return;
  }
  void loadAndPlay(index - 1);
}

export function seek(seconds: number): void {
  if (!Number.isFinite(seconds)) return;
  audio.currentTime = Math.max(0, seconds);
  usePlayer.getState().setState({ position: audio.currentTime });
}

export function setVolume(volume: number): void {
  audio.volume = volume;
  usePlayer.getState().setState({ volume });
}

export function removeFromQueue(position: number): void {
  const state = usePlayer.getState();
  const queue = state.queue.filter((_, i) => i !== position);
  let index = state.index;
  if (position < state.index) index -= 1;
  if (position === state.index) {
    audio.pause();
    audio.removeAttribute('src');
    usePlayer.getState().setState({ queue, index: -1, playing: false, position: 0, duration: 0 });
    return;
  }
  usePlayer.getState().setState({ queue, index });
}

/** The current track, to show in the bar and the lyrics panel. */
export function currentTrack(): Track | null {
  const { queue, index } = usePlayer.getState();
  return index >= 0 ? queue[index] ?? null : null;
}

function updateSession(track: Track) {
  if (!('mediaSession' in navigator)) return;
  const art = imageUrl(track.cover);
  navigator.mediaSession.metadata = new MediaMetadata({
    title: titleOf(track),
    artist: artistsOf(track),
    album: track.album ? titleOf(track.album) : '',
    artwork: art ? [{ src: art, sizes: '512x512' }] : [],
  });
}

function setupSessionHandlers() {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', () => togglePlay());
  ms.setActionHandler('pause', () => togglePlay());
  ms.setActionHandler('previoustrack', () => prevTrack());
  ms.setActionHandler('nexttrack', () => nextTrack());
  ms.setActionHandler('seekto', (d) => d.seekTime != null && seek(d.seekTime));
}

audio.addEventListener('play', () => usePlayer.getState().setState({ playing: true, loading: false }));
audio.addEventListener('pause', () => usePlayer.getState().setState({ playing: false }));
audio.addEventListener('waiting', () => usePlayer.getState().setState({ loading: true }));
audio.addEventListener('playing', () => usePlayer.getState().setState({ loading: false }));
audio.addEventListener('loadedmetadata', () => usePlayer.getState().setState({ duration: audio.duration || 0 }));
audio.addEventListener('timeupdate', () => usePlayer.getState().setState({ position: audio.currentTime }));
audio.addEventListener('ended', () => nextTrack());
audio.addEventListener('error', () => {
  const state = usePlayer.getState();
  const track = state.queue[state.index];
  if (!track || !audio.src || proxied) {
    usePlayer.getState().setState({ loading: false, playing: false });
    setError('This track could not be loaded.');
    return;
  }
  // Retry once through the server proxy, keeping the position.
  proxied = true;
  const current = audio.src;
  const original = urlCache.get(track.id) ?? current;
  audio.src = proxyUrl(original);
  audio.currentTime = 0;
  void audio.play().catch(() => setError('This track could not be loaded.'));
});

audio.volume = usePlayer.getState().volume;
setupSessionHandlers();
