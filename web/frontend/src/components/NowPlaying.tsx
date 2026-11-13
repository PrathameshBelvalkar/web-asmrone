import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Heart, ListMusic, Mic2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { useLike } from '../api/mutations';
import { likeOptions } from '../api/queries';
import type { Track } from '../api/types';
import { artistsOf, formatTime, imageUrl, titleOf } from '../lib/media';
import { loadAndPlay, nextTrack, prevTrack, removeFromQueue, seek, togglePlay } from '../player/engine';
import { usePlayer } from '../player/store';
import type { RepeatMode } from '../player/store';
import { Cover } from './Cover';
import { LyricsView } from './Lyrics';
import { TrackMenu } from './TrackMenu';
import { Slider } from './ui/slider';
import { cn } from '@/lib/utils';

const REPEAT_NEXT: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' };

/** Full-screen player: a blurred cover behind it, artwork and controls on the left, lyrics on the right. */
export function NowPlaying() {
  const track = usePlayer((s) => (s.index >= 0 ? s.queue[s.index] : undefined));
  const tab = usePlayer((s) => s.nowPlayingTab);
  const setState = usePlayer((s) => s.setState);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setState({ nowPlayingOpen: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setState]);

  if (!track) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      className="fixed inset-0 z-50 overflow-hidden bg-black text-white"
      style={{ animation: 'rise 220ms cubic-bezier(0.22, 1, 0.36, 1)' }}
    >
      <AmbientBackground holder={track.cover} />
      <div className="relative z-10 flex h-full flex-col md:flex-row">
        {/* Sticky on phones so the close button and tabs stay reachable; overlays the top on desktop. */}
        <header className="relative z-20 flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3 md:absolute md:inset-x-0 md:top-0 md:px-6 md:pt-5">
          <button type="button" onClick={() => setState({ nowPlayingOpen: false })} aria-label="Close now playing" className="flex size-10 items-center justify-center rounded-full bg-black/30 text-white/80 backdrop-blur transition-colors hover:text-white">
            <ChevronDown size={22} aria-hidden />
          </button>
          <div className="flex rounded-full bg-black/30 p-1 backdrop-blur">
            <TabPill active={tab === 'lyrics'} onClick={() => setState({ nowPlayingTab: 'lyrics' })} icon={Mic2}>Lyrics</TabPill>
            <TabPill active={tab === 'queue'} onClick={() => setState({ nowPlayingTab: 'queue' })} icon={ListMusic}>Queue</TabPill>
          </div>
        </header>
        <Controls track={track} />
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col md:pt-20">
            {tab === 'lyrics' ? <LyricsView track={track} /> : <div className="h-full overflow-y-auto px-6 pb-10 pt-4 md:px-12 md:pt-6"><QueueList /></div>}
          </div>
        </section>
      </div>
    </div>
  );
}

/** The cover, blurred and dimmed, held still behind the controls. */
function AmbientBackground({ holder }: { holder: Track['cover'] }) {
  const src = imageUrl(holder);
  return (
    <div aria-hidden className="fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-neutral-950" />
      {src && (
        <img
          src={src}
          alt=""
          className="absolute -inset-[15%] h-[130%] w-[130%] max-w-none object-cover opacity-50 blur-3xl"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-black/75" />
    </div>
  );
}

function Controls({ track }: { track: Track }) {
  const playing = usePlayer((s) => s.playing);
  const loading = usePlayer((s) => s.loading);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const setState = usePlayer((s) => s.setState);
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;
  const like = useQuery({ ...likeOptions(track), staleTime: 0 });
  const likeMutation = useLike(track);
  const liked = like.data?.liked ?? false;

  const favourite = () => {
    if (!like.data) return;
    likeMutation.mutate(!liked);
  };

  return (
    <section className="flex shrink-0 flex-col items-center justify-center gap-4 px-6 pb-4 md:w-[44%] md:items-stretch md:gap-6 md:px-14 md:pb-12 md:pt-12">
      <Cover holder={track.cover} className="aspect-square w-[min(30vh,340px)] max-w-full shadow-2xl shadow-black/60 md:w-full md:max-w-[400px]" rounded="rounded-xl" />

      <div className="flex w-full max-w-[400px] items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-semibold tracking-tight">{titleOf(track)}</h2>
          <p className="truncate text-base text-white/70">{artistsOf(track)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={favourite}
            disabled={!like.data}
            aria-label={liked ? 'Remove from favourites' : 'Add to favourites'}
            aria-pressed={liked}
            className={cn('flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/10 disabled:opacity-40', liked ? 'text-primary' : 'text-white/80 hover:text-white')}
          >
            <Heart size={20} fill={liked ? 'currentColor' : 'none'} aria-hidden />
          </button>
          <TrackMenu track={track} label="More options" className="size-10 text-white/80 opacity-100 hover:bg-white/10 hover:text-white sm:opacity-100" />
        </div>
      </div>

      <div className="w-full max-w-[400px] space-y-2">
        <Slider
          aria-label="Seek"
          min={0}
          max={duration || 1}
          step={0.1}
          value={[Math.min(position, duration || 0)]}
          disabled={!duration}
          onValueChange={([v]) => seek(v)}
          className="[&_[data-slot=slider-track]]:bg-white/25 [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:border-white"
        />
        <div className="flex justify-between font-mono text-xs tnum text-white/60">
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex w-full max-w-[400px] items-center justify-between">
        <button type="button" aria-label={shuffle ? 'Shuffle on' : 'Shuffle off'} aria-pressed={shuffle} onClick={() => setState({ shuffle: !shuffle })} className={cn('flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/10', shuffle ? 'text-white' : 'text-white/50 hover:text-white')}>
          <Shuffle size={18} aria-hidden />
        </button>
        <button type="button" aria-label="Previous" onClick={prevTrack} className="flex size-12 items-center justify-center rounded-full text-white transition-[background-color,transform] hover:bg-white/10 active:scale-[0.97]">
          <SkipBack size={26} fill="currentColor" aria-hidden />
        </button>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="flex size-16 items-center justify-center rounded-full bg-white text-black transition-[background-color,transform] hover:bg-white/90 active:scale-[0.97]"
        >
          {loading ? <span className="size-5 animate-spin rounded-full border-2 border-black/30 border-t-black" aria-hidden /> : playing ? <Pause size={26} fill="currentColor" aria-hidden /> : <Play size={26} fill="currentColor" className="ml-1" aria-hidden />}
        </button>
        <button type="button" aria-label="Next" onClick={nextTrack} className="flex size-12 items-center justify-center rounded-full text-white transition-[background-color,transform] hover:bg-white/10 active:scale-[0.97]">
          <SkipForward size={26} fill="currentColor" aria-hidden />
        </button>
        <button type="button" aria-label={`Repeat: ${repeat}`} aria-pressed={repeat !== 'off'} onClick={() => setState({ repeat: REPEAT_NEXT[repeat] })} className={cn('flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/10', repeat !== 'off' ? 'text-white' : 'text-white/50 hover:text-white')}>
          <RepeatIcon size={18} aria-hidden />
        </button>
      </div>
    </section>
  );
}

function TabPill({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Mic2; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn('flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors', active ? 'bg-white text-black' : 'text-white/70 hover:text-white')}
    >
      <Icon size={15} aria-hidden />
      {children}
    </button>
  );
}

function QueueList() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  if (!queue.length) return <p className="text-white/60">Nothing in the queue yet.</p>;
  return (
    <ol className="space-y-1">
      {queue.map((t, i) => {
        const current = i === index;
        return (
          <li key={`${t.id}-${i}`} className={cn('group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors', current ? 'bg-white/15' : 'hover:bg-white/10')}>
            <button type="button" onClick={() => void loadAndPlay(i)} className="min-w-0 flex-1 text-left">
              <span className={cn('block truncate text-sm', current ? 'font-medium text-white' : 'text-white/85')}>{titleOf(t)}</span>
              <span className="block truncate text-xs text-white/55">{artistsOf(t)}</span>
            </button>
            <button type="button" onClick={() => removeFromQueue(i)} aria-label={`Remove ${titleOf(t)} from queue`} className="rounded px-2 py-1 text-xs text-white/60 opacity-0 transition-[color,opacity] hover:text-white group-hover:opacity-100 focus-visible:opacity-100">
              Remove
            </button>
          </li>
        );
      })}
    </ol>
  );
}
