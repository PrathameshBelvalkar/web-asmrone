import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { MediaItem } from '../api/types';
import { artistsOf, kindOf, titleOf } from '../lib/media';
import { openMedia, playItem } from '../lib/actions';
import { usePlayer } from '../player/store';
import { Cover } from './Cover';
import { Equaliser } from './Equaliser';

/**
 * Album, artist or playlist tile (YouTube Music style). On hover the cover darkens and a round
 * play button rises in its corner; artists use round art and just open.
 */
export function MediaCard({ item, onClick, fluid = false, style }: { item: MediaItem; onClick?: () => void; fluid?: boolean; style?: CSSProperties }) {
  const navigate = useNavigate();
  const title = titleOf(item);
  const sub = artistsOf(item);
  const artist = kindOf(item) === 'Artist';
  // This card's work is what's playing (a track's album, or the track itself).
  const playingHere = usePlayer((s) => {
    const t = s.index >= 0 ? s.queue[s.index] : undefined;
    return !!t && s.playing && (t.id === item.id || t.album?.id === item.id);
  });
  const open = onClick ?? (() => openMedia(item, navigate));

  return (
    <div className={`group relative flex flex-col ${fluid ? 'w-full' : 'w-40 shrink-0 snap-start sm:w-48'}`} style={style}>
      <div className="relative">
        <button type="button" onClick={open} title={title} aria-label={title} className="block w-full rounded-xl">
          <Cover
            holder={item.cover}
            className="aspect-square w-full shadow-lg shadow-black/40 transition duration-300 ease-out group-hover:shadow-2xl group-hover:shadow-black/60"
            rounded={artist ? 'rounded-full' : 'rounded-xl'}
          />
          {!artist && (
            <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" aria-hidden />
          )}
        </button>
        {!artist && (
          <button
            type="button"
            onClick={() => void playItem(item)}
            aria-label={`Play ${title}`}
            title={`Play ${title}`}
            className="absolute bottom-2.5 right-2.5 flex size-11 translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-xl shadow-black/50 transition duration-300 ease-out hover:scale-110 focus-visible:translate-y-0 focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 active:scale-95"
          >
            <Play size={18} fill="currentColor" className="ml-0.5" aria-hidden />
          </button>
        )}
        {playingHere && (
          <span className="absolute left-2.5 top-2.5 flex size-8 items-center justify-center rounded-full bg-black/60 text-primary backdrop-blur" aria-label="Playing">
            <Equaliser />
          </span>
        )}
      </div>
      <button type="button" onClick={open} className={`mt-3 text-left ${artist ? 'text-center' : ''}`} tabIndex={-1}>
        <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">{title}</span>
        {sub && <span className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">{sub}</span>}
      </button>
    </div>
  );
}
