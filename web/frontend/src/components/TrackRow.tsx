import type { Track } from '../api/types';
import { artistsOf, formatDuration, isPlayable, titleOf } from '../lib/media';
import { usePlayer } from '../player/store';
import { Cover } from './Cover';
import { TrackMenu } from './TrackMenu';

/** One track in a list. Clicking plays the list from this track. */
export function TrackRow({ track, index, onPlay }: { track: Track; index?: number; onPlay: () => void }) {
  const playable = isPlayable(track);
  const current = usePlayer((s) => s.index >= 0 && s.queue[s.index]?.id === track.id);
  const playing = usePlayer((s) => s.playing);
  const showBars = current && playing;

  return (
    <div
      className={`group grid grid-cols-[2rem_minmax(0,1fr)_auto_2rem] items-center gap-3 rounded-lg px-2 py-1.5 transition duration-150 sm:grid-cols-[2.5rem_2.75rem_minmax(0,1fr)_auto_2rem] ${current ? 'bg-primary/15' : 'hover:bg-accent'} ${playable ? '' : 'opacity-50'}`}
    >
      <div className="flex justify-center text-sm tnum text-muted-foreground">
        {showBars ? <Equaliser /> : index !== undefined ? <span className={current ? 'text-primary' : ''}>{index + 1}</span> : null}
      </div>
      <Cover holder={track.cover} className="hidden h-11 w-11 sm:block" rounded="rounded-md" />
      <button
        type="button"
        disabled={!playable}
        onClick={onPlay}
        className="min-w-0 text-left disabled:cursor-not-allowed"
      >
        <span className={`block truncate text-sm ${current ? 'font-medium text-primary' : 'text-foreground'}`}>{titleOf(track)}</span>
        <span className="block truncate text-xs text-muted-foreground">{playable ? artistsOf(track) : 'Open the work to listen to this'}</span>
      </button>
      <span className="hidden text-xs tnum text-muted-foreground sm:block">{formatDuration(track.duration)}</span>
      <div className="flex justify-end">
        <TrackMenu track={track} label={`More options for ${titleOf(track)}`} />
      </div>
    </div>
  );
}

function Equaliser() {
  return (
    <span className="flex h-4 items-end gap-0.5" aria-label="Playing" role="img">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-0.5 origin-bottom rounded-full bg-primary"
          style={{ height: '100%', animation: `eq 900ms ease-in-out ${i * 150}ms infinite` }}
        />
      ))}
    </span>
  );
}
