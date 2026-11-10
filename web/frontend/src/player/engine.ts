import Hls from 'hls.js';
import { proxyUrl } from '../api/client';
import { mediaOptions } from '../api/queries';
import { queryClient } from '../lib/queryClient';
import type { Track } from '../api/types';
import { artistsOf, imageUrl, titleOf } from '../lib/media';
import { usePlayer } from './store';

/**
 * One audio element for the whole app, so playback continues across pages.
 *
 * Files come from the server: progressive files play directly, and if the browser can't load one it
 * is retried once through the server's media proxy. HLS playlists (japaneseasmr.com) always go
 * through the proxy and are played with hls.js (Safari plays them natively).
 *
 * A chapter is a track with `extras.start` (and `extras.end`) in seconds inside one file. Chapters
 * of the same file share the loaded file, so moving between them does not reload it.
 */
const audio = new Audio();
audio.preload = 'auto';

interface Stream {
  readonly url: string;
  readonly hls: boolean;
}

let token = 0;
let proxied = false;
let streaming = false;
let hls: Hls | null = null;
/** The remote URL of the file that is loaded now. */
let loadedUrl: string | null = null;
/** Where the current chapter starts and ends inside the loaded file (end null = end of file). */
let base = 0;
let end: number | null = null;
let pendingSeek: number | null = null;
const streams = new Map<string, Stream>();

async function resolveStream(track: Track): Promise<Stream> {
  const cached = streams.get(track.id);
  if (cached) return cached;
  const media = await queryClient.fetchQuery(mediaOptions(track));
  const source = media.sources.find((s) => s.request?.url);
  if (!source?.request) throw new Error('This track has no playable stream.');
  const stream: Stream = { url: source.request.url, hls: source.type === 'HLS' };
  streams.set(track.id, stream);
  return stream;
}

/** Chapter start in seconds (0 for a whole file). */
function startOf(track: Track): number {
  const value = Number(track.extras?.start ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Chapter end in seconds, or null when the chapter runs to the end of the file. */
function endOf(track: Track): number | null {
  const raw = track.extras?.end;
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function setError(message: string | null) {
  usePlayer.getState().setState({ error: message });
}

function destroyHls() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
}

/** Points the audio element at a stream. HLS goes through hls.js unless the browser plays it natively. */
function attach(stream: Stream) {
  destroyHls();
  proxied = false;
  streaming = stream.hls;
  loadedUrl = stream.url;
  if (!stream.hls) {
    audio.src = stream.url;
    return;
  }
  const playlist = proxyUrl(stream.url);
  if (Hls.isSupported()) {
    const instance = new Hls();
    instance.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (hls === instance) destroyHls();
      loadedUrl = null;
      usePlayer.getState().setState({ loading: false, playing: false });
      setError('This work could not be played.');
    });
    instance.loadSource(playlist);
    instance.attachMedia(audio);
    hls = instance;
  } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
    audio.src = playlist;
  } else {
    throw new Error('This browser cannot play this stream.');
  }
}

/** Length of the current chapter, in seconds. */
function chapterDuration(): number {
  const total = audio.duration;
  const stop = end ?? (Number.isFinite(total) && total > 0 ? total : null);
  return stop === null ? 0 : Math.max(0, stop - base);
}

export async function loadAndPlay(index: number): Promise<void> {
  const state = usePlayer.getState();
  const track = state.queue[index];
  if (!track) return;
  const myToken = ++token;
  proxied = false;
  state.setState({ index, loading: true, error: null, position: 0, duration: 0 });
  try {
    const stream = await resolveStream(track);
    if (myToken !== token) return;
    base = startOf(track);
    end = endOf(track);
    if (stream.url === loadedUrl) {
      // Same file: only move to the chapter.
      audio.currentTime = base;
    } else {
      attach(stream);
      pendingSeek = base;
    }
    usePlayer.getState().setState({ duration: chapterDuration(), position: 0 });
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
    if (loadedUrl === null) void loadAndPlay(state.index);
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
  if (audio.currentTime - base > 3 || index <= 0) {
    seek(0);
    return;
  }
  void loadAndPlay(index - 1);
}

/** Seek within the current track (chapter-relative seconds). */
export function seek(seconds: number): void {
  if (!Number.isFinite(seconds)) return;
  const offset = Math.max(0, seconds);
  audio.currentTime = base + offset;
  usePlayer.getState().setState({ position: offset });
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
    destroyHls();
    loadedUrl = null;
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
audio.addEventListener('loadedmetadata', () => {
  if (pendingSeek !== null) {
    audio.currentTime = pendingSeek;
    pendingSeek = null;
  }
  usePlayer.getState().setState({ duration: chapterDuration() });
});
audio.addEventListener('durationchange', () => usePlayer.getState().setState({ duration: chapterDuration() }));
audio.addEventListener('timeupdate', () => {
  if (end !== null && audio.currentTime >= end) {
    // The chapter is over. Clear the end first so a repeated event cannot advance twice.
    end = null;
    nextTrack();
    return;
  }
  usePlayer.getState().setState({ position: Math.max(0, audio.currentTime - base) });
});
audio.addEventListener('ended', () => nextTrack());
audio.addEventListener('error', () => {
  const state = usePlayer.getState();
  const track = state.queue[state.index];
  if (!track || loadedUrl === null || proxied || streaming) {
    usePlayer.getState().setState({ loading: false, playing: false });
    setError('This track could not be loaded.');
    return;
  }
  // Retry once through the server proxy, keeping the chapter position.
  proxied = true;
  const original = streams.get(track.id)?.url ?? loadedUrl;
  pendingSeek = base;
  audio.src = proxyUrl(original);
  void audio.play().catch(() => setError('This track could not be loaded.'));
});

audio.volume = usePlayer.getState().volume;
setupSessionHandlers();
