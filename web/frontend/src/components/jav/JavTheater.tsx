import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Hls from 'hls.js';
import { useQuery } from '@tanstack/react-query';
import { MediaPlayer, MediaProvider, Poster, isHLSProvider, type MediaPlayerInstance, type PlayerSrc } from '@vidstack/react';
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { RotateCw, TriangleAlert } from 'lucide-react';
import { ApiError, api, proxyUrl } from '../../api/client';
import { recordWatch, resumeAt, useWatchEntry, type WatchedMovie } from '../../lib/history';

/** How often the position is saved while playing. */
const SAVE_EVERY_MS = 5_000;
/** Edge to edge, no corners; a very wide window letterboxes rather than growing past the screen. */
export const THEATER_BOX = 'aspect-video max-h-[calc(100svh-4rem)] w-full overflow-hidden bg-black';

export type TheaterSource = { type: 'movie' } | { type: 'trailer'; url: string };

/**
 * The theater player (Vidstack). The full movie comes from its STREAM SB stream (docs/JAV.md
 * section 11): the playlists load through the proxy and the video segments from their CDN. It picks
 * up where you left off and saves your place as you watch. A trailer plays from its host.
 */
export function JavTheater({
  movie, source, poster, fromStart = false,
}: { movie: WatchedMovie; source: TheaterSource; poster?: string; fromStart?: boolean }) {
  if (source.type === 'trailer') {
    return (
      <Player
        src={{ src: source.url, type: 'video/mp4' }}
        title={`${movie.dvdId ?? movie.title} · Trailer`}
        poster={poster}
        // DMM's video host answers 403 outside Japan, on javdatabase.com too.
        failText={/\.dmm\.co\.jp\//.test(source.url) ? 'Trailer unavailable: DMM only serves trailers in Japan.' : 'Trailer unavailable.'}
      />
    );
  }
  return <MovieStream movie={movie} poster={poster} fromStart={fromStart} />;
}

function MovieStream({ movie, poster, fromStart }: { movie: WatchedMovie; poster?: string; fromStart: boolean }) {
  const stream = useQuery({
    queryKey: ['jav', 'stream', movie.kind, movie.slug],
    queryFn: () => api.jav.stream(movie.kind, movie.slug),
    // The host's links expire; the server hands out the same one for an hour.
    staleTime: 30 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  });
  const entry = useWatchEntry(movie.kind, movie.slug);
  // Read once: later saves must not move the start point.
  const [start] = useState(() => (fromStart ? null : resumeAt(entry)));

  if (stream.error) {
    const busy = stream.error instanceof ApiError && stream.error.status === 503;
    return (
      <Notice
        title={errorText(stream.error)}
        action={
          busy && (
            <button
              type="button"
              onClick={() => void stream.refetch()}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/20 px-4 text-sm font-medium text-white hover:bg-white/10"
            >
              <RotateCw size={15} aria-hidden /> Try again
            </button>
          )
        }
      />
    );
  }
  if (!stream.data) {
    return (
      <div className={`${THEATER_BOX} grid place-items-center`} role="status">
        <div className="flex flex-col items-center gap-3 text-sm text-white/70">
          <span className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-primary" aria-hidden />
          Finding the stream…
        </div>
      </div>
    );
  }
  return (
    <Player
      src={{ src: proxyUrl(stream.data.master), type: 'application/x-mpegurl' }}
      title={movie.dvdId ?? movie.title}
      poster={poster}
      start={start}
      movie={movie}
    />
  );
}

/** The Vidstack player in the theater box. Hanime's title page uses it too. */
export function Player({
  src, title, poster, start = null, movie, failText = 'This stream could not be played.',
}: {
  src: PlayerSrc;
  title: string;
  poster?: string;
  start?: number | null;
  /** Shown in place of the player when the video can't be loaded or played. */
  failText?: string;
  /** Given for the full movie: its position is saved. */
  movie?: WatchedMovie;
}) {
  const player = useRef<MediaPlayerInstance>(null);
  const savedAt = useRef(0);
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  const save = (force = false) => {
    const p = player.current;
    if (!movie || !p) return;
    const { currentTime, duration } = p.state;
    if (!(duration > 0) || currentTime <= 0) return;
    const now = Date.now();
    if (!force && now - savedAt.current < SAVE_EVERY_MS) return;
    savedAt.current = now;
    recordWatch(movie, currentTime, duration, now);
  };
  // Save the last position when the player closes.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => () => saveRef.current(true), []);

  // Vidstack loads a file through a <source>. A refused file (a trailer host's 403) fires `error` on
  // the <source>, not on the <video>, and Vidstack doesn't pass it on, so listen for it here.
  useEffect(() => {
    const el = player.current?.el;
    if (!el) return;
    const onSourceError = (e: Event) => {
      if (e.target instanceof HTMLSourceElement) setFailed(true);
    };
    el.addEventListener('error', onSourceError, true);
    return () => el.removeEventListener('error', onSourceError, true);
  }, []);

  if (failed) return <Notice title={failText} />;

  return (
    <MediaPlayer
      ref={player}
      className={`${THEATER_BOX} jav-theater`}
      style={{ '--video-brand': 'var(--primary)', '--video-border-radius': '0px' }}
      title={title}
      src={src}
      viewType="video"
      streamType="on-demand"
      playsInline
      autoPlay
      onProviderChange={(provider) => {
        // Echo's own hls.js, not a copy from a CDN.
        if (isHLSProvider(provider)) provider.library = Hls;
      }}
      onCanPlay={() => {
        if (started.current) return;
        started.current = true;
        if (start !== null && player.current) player.current.currentTime = start;
      }}
      onTimeUpdate={() => save()}
      onPause={() => save(true)}
      onEnded={() => save(true)}
      // A refused or broken video file (a trailer host's 403, an unplayable segment).
      onError={() => setFailed(true)}
      onHlsError={(detail) => {
        if (detail.fatal) setFailed(true);
      }}
    >
      <MediaProvider>{poster && <Poster className="vds-poster" src={poster} alt="" />}</MediaProvider>
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  );
}

/** A message in place of the player. */
export function Notice({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className={`${THEATER_BOX} grid place-items-center p-6`} role="status">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <TriangleAlert size={26} className="text-white/60" aria-hidden />
        <p className="text-sm text-white/80">{title}</p>
        {action}
      </div>
    </div>
  );
}

function errorText(error: Error): string {
  if (!(error instanceof ApiError)) return 'The stream could not be loaded.';
  if (error.status === 404) return error.message || 'No stream was found for this movie.';
  if (error.status === 451) return "This title isn't available in Echo.";
  if (error.status === 503) return 'The stream source is busy. Try again later.';
  return 'The stream could not be found on its host.';
}
