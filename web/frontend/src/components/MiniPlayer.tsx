import { LoaderCircle, Pause, Play, SkipForward } from 'lucide-react';
import { Cover } from './Cover';
import { artistsOf, titleOf } from '../lib/media';
import { nextTrack, togglePlay } from '../player/engine';
import { usePlayer } from '../player/store';
import { cn } from '@/lib/utils';

/**
 * A small square player for the manga pages, in the bottom-right corner: the artwork with the title
 * over it, play/pause and next, and a thin progress line. Clicking the artwork opens Now Playing.
 * Renders nothing when nothing is playing.
 */
export function MiniPlayer() {
  const track = usePlayer((s) => (s.index >= 0 ? s.queue[s.index] : undefined));
  const playing = usePlayer((s) => s.playing);
  const loading = usePlayer((s) => s.loading);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const setState = usePlayer((s) => s.setState);
  if (!track) return null;

  const progress = duration ? Math.min(100, (position / duration) * 100) : 0;
  const Icon = loading ? LoaderCircle : playing ? Pause : Play;
  const control =
    'flex size-9 items-center justify-center rounded-full transition-[background-color,transform] duration-150 active:scale-[0.95]';

  return (
    <aside
      aria-label="Now playing"
      className="group fixed bottom-4 right-4 z-30 size-40 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl shadow-black/60 sm:bottom-6 sm:right-6 sm:size-44"
      style={{ animation: 'rise 300ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
    >
      <button
        type="button"
        onClick={() => setState({ nowPlayingOpen: true })}
        aria-label={`Open now playing: ${titleOf(track)}`}
        className="absolute inset-0"
      >
        <Cover holder={track.cover} className="h-full w-full" rounded="rounded-none" />
      </button>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" aria-hidden />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 pb-3.5 text-white">
        <p className="truncate text-sm font-medium leading-tight">{titleOf(track)}</p>
        <p className="truncate text-xs text-white/70">{artistsOf(track)}</p>
        <div className="pointer-events-auto mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className={cn(control, 'bg-white text-black hover:bg-white/90')}
          >
            <Icon size={16} strokeWidth={2.4} className={loading ? 'animate-spin' : ''} fill={!loading && playing ? 'currentColor' : 'none'} aria-hidden />
          </button>
          <button type="button" onClick={nextTrack} aria-label="Next" className={cn(control, 'text-white hover:bg-white/15')}>
            <SkipForward size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15" aria-hidden>
        <div className="h-full bg-player-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>
    </aside>
  );
}
