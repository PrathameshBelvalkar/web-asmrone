import { Play } from 'lucide-react';
import type { Track } from '../api/types';
import { artistsOf, formatDuration, isPlayable, titleOf } from '../lib/media';
import { usePlayer } from '../player/store';
import { Cover } from './Cover';
import { Equaliser } from './Equaliser';
import { TrackMenu } from './TrackMenu';

/** One track in a list. Clicking plays the list from this track; the number turns into a play icon on hover. */
export function TrackRow({ track, index, onPlay }: { track: Track; index?: number; onPlay: () => void }) {
  const playable = isPlayable(track);
  const current = usePlayer((s) => s.index >= 0 && s.queue[s.index]?.id === track.id);
  const playing = usePlayer((s) => s.playing);
  const showBars = current && playing;

  return (
    <div
      className={`group grid grid-cols-[2rem_minmax(0,1fr)_auto_2rem] items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-150 sm:grid-cols-[2.5rem_3rem_minmax(0,1fr)_auto_2rem] ${current ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'} ${playable ? '' : 'opacity-50'}`}
      onDoubleClick={playable ? onPlay : undefined}
    >
      <div className="flex justify-center text-sm tnum text-muted-foreground">
        {showBars ? (
          <Equaliser className="text-primary" />
        ) : (
          <>
            {index !== undefined && <span className={`${playable ? 'group-hover:hidden' : ''} ${current ? 'text-primary' : ''}`}>{index + 1}</span>}
            {playable && (
              <button type="button" onClick={onPlay} aria-label={`Play ${titleOf(track)}`} className={`text-foreground ${index !== undefined ? 'hidden group-hover:block' : 'opacity-0 group-hover:opacity-100'}`}>
                <Play size={15} fill="currentColor" aria-hidden />
              </button>
            )}
          </>
        )}
      </div>
      <Cover holder={track.cover} className="hidden h-12 w-12 shadow-md shadow-black/30 sm:block" rounded="rounded-lg" />
      <button
        type="button"
        disabled={!playable}
        onClick={onPlay}
        className="min-w-0 text-left disabled:cursor-not-allowed"
      >
        <span className={`block truncate text-sm ${current ? 'font-medium text-primary' : 'font-medium text-foreground'}`}>{titleOf(track)}</span>
        <span className="block truncate text-[13px] text-muted-foreground">{playable ? artistsOf(track) : 'Open the work to listen to this'}</span>
      </button>
      <span className="hidden font-mono text-xs tnum text-muted-foreground sm:block">{formatDuration(track.duration)}</span>
      <div className="flex justify-end">
        <TrackMenu track={track} label={`More options for ${titleOf(track)}`} />
      </div>
    </div>
  );
}
