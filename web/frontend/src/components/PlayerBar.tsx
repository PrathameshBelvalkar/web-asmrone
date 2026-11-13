import { LoaderCircle, Maximize2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Cover } from './Cover';
import { IconButton } from './ui';
import { Slider } from './ui/slider';
import { artistsOf, formatTime, routeFor, titleOf } from '../lib/media';
import { nextTrack, prevTrack, seek, setVolume, togglePlay } from '../player/engine';
import { usePlayer } from '../player/store';
import type { RepeatMode } from '../player/store';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const REPEAT_NEXT: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' };

/**
 * Floating player card, styled like Better Lyrics: frosted glass, pill controls, and a thin
 * progress line that shows its handle on hover. Times sit either side of the progress line.
 */
export function PlayerBar() {
  const navigate = useNavigate();
  const track = usePlayer((s) => (s.index >= 0 ? s.queue[s.index] : undefined));
  const playing = usePlayer((s) => s.playing);
  const loading = usePlayer((s) => s.loading);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const volume = usePlayer((s) => s.volume);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const error = usePlayer((s) => s.error);
  const setState = usePlayer((s) => s.setState);

  const open = () => track && setState({ nowPlayingOpen: true });
  const route = track ? routeFor(track) : null;
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;
  const VolumeIcon = volume === 0 ? VolumeX : Volume2;
  const progress = duration ? Math.min(100, (position / duration) * 100) : 0;
  const isLoading = loading;

  const playPause = (size: 'sm' | 'md') => {
    const Icon = isLoading ? LoaderCircle : playing ? Pause : Play;
    return (
      <button
        type="button"
        onClick={togglePlay}
        disabled={!track}
        aria-label={playing ? 'Pause' : 'Play'}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-[background-color,transform] duration-150 hover:bg-foreground/90 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
          size === 'md' ? 'size-10' : 'size-9',
        )}
      >
        <Icon size={size === 'md' ? 18 : 16} strokeWidth={2.4} className={isLoading ? 'animate-spin' : ''} fill={!isLoading && playing ? 'currentColor' : 'none'} aria-hidden />
      </button>
    );
  };

  return (
    <footer className="px-2 pb-2 md:px-4 md:pb-4">
      {/* Frosted glass tinted with the playing artwork's colour (--player-accent). */}
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/60 backdrop-blur-2xl backdrop-saturate-150 transition-[background-color] duration-1000"
        style={{ backgroundColor: 'color-mix(in oklab, var(--player-accent) 13%, oklch(0.17 0 0 / 0.82))' }}
      >
        {error && <div role="status" className="bg-destructive/15 px-4 py-1.5 text-center text-xs text-destructive">{error}</div>}

        {/* Phone: compact row, progress line along the bottom edge */}
        <div className="flex items-center gap-3 px-3 py-2.5 md:hidden">
          <button type="button" onClick={open} disabled={!track} className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:pointer-events-none">
            <Cover holder={track?.cover} className="size-11 shrink-0" rounded="rounded-lg" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{track ? titleOf(track) : 'Nothing playing'}</div>
              <div className="truncate text-xs text-muted-foreground">{track ? artistsOf(track) : 'Pick a work to start listening'}</div>
            </div>
          </button>
          {playPause('sm')}
          <IconButton icon={SkipForward} label="Next" size="sm" onClick={nextTrack} disabled={!track} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground/10 md:hidden" aria-hidden>
          <div className="h-full bg-player-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Desktop: info | transport + progress | volume */}
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-6 px-5 py-3.5 md:grid">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={open} disabled={!track} className="shrink-0 disabled:pointer-events-none" aria-label="Open now playing">
              <Cover holder={track?.cover} className="size-14 transition-[filter] duration-150 hover:brightness-110" rounded="rounded-xl" />
            </button>
            <div className="min-w-0">
              <button type="button" disabled={!route} onClick={() => route && navigate(route)} className="block max-w-full truncate text-left text-sm font-medium hover:underline disabled:no-underline">
                {track ? titleOf(track) : 'Nothing playing'}
              </button>
              <div className="truncate text-xs text-muted-foreground">{track ? artistsOf(track) : 'Pick a work to start listening'}</div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col items-center gap-2">
            <div className="flex items-center gap-1.5">
              <IconButton icon={Shuffle} label={shuffle ? 'Shuffle on' : 'Shuffle off'} active={shuffle} size="sm" onClick={() => setState({ shuffle: !shuffle })} />
              <IconButton icon={SkipBack} label="Previous" size="md" onClick={prevTrack} disabled={!track} />
              {playPause('md')}
              <IconButton icon={SkipForward} label="Next" size="md" onClick={nextTrack} disabled={!track} />
              <IconButton icon={RepeatIcon} label={`Repeat: ${repeat}`} active={repeat !== 'off'} size="sm" onClick={() => setState({ repeat: REPEAT_NEXT[repeat] })} />
            </div>
            <div className="flex w-full max-w-xl items-center gap-3 font-mono text-xs tnum text-muted-foreground">
              <span className="w-10 text-right">{formatTime(position)}</span>
              <Slider
                aria-label="Seek"
                min={0}
                max={duration || 1}
                step={0.1}
                value={[Math.min(position, duration || 0)]}
                disabled={!track || !duration}
                onValueChange={([v]) => seek(v)}
                className="seek-bar min-w-0 flex-1"
              />
              <span className="w-10">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5">
            <IconButton icon={VolumeIcon} label={volume === 0 ? 'Unmute' : 'Mute'} size="sm" onClick={() => setVolume(volume === 0 ? 1 : 0)} />
            <Slider aria-label="Volume" min={0} max={1} step={0.01} value={[volume]} onValueChange={([v]) => setVolume(v)} className="volume-bar w-24" />
            <IconButton icon={Maximize2} label="Open now playing" size="sm" disabled={!track} onClick={open} />
          </div>
        </div>
      </div>
    </footer>
  );
}
