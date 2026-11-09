import { useNavigate } from 'react-router-dom';
import type { MediaItem } from '../api/types';
import { artistsOf, kindOf, titleOf } from '../lib/media';
import { openMedia } from '../lib/actions';
import { Cover } from './Cover';

/** Album, artist or playlist tile. Lifts on hover; artists use round art. */
export function MediaCard({ item, onClick, fluid = false }: { item: MediaItem; onClick?: () => void; fluid?: boolean }) {
  const navigate = useNavigate();
  const title = titleOf(item);
  const sub = artistsOf(item);
  const artist = kindOf(item) === 'Artist';
  return (
    <button
      type="button"
      onClick={onClick ?? (() => openMedia(item, navigate))}
      className={`group flex flex-col text-left ${fluid ? 'w-full' : 'w-36 shrink-0 snap-start sm:w-44'}`}
      title={title}
    >
      <Cover
        holder={item.cover}
        className="aspect-square w-full shadow-md shadow-black/30 transition duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-xl group-hover:shadow-black/50"
        rounded={artist ? 'rounded-full' : 'rounded-lg'}
      />
      <span className={`mt-3 line-clamp-2 text-sm font-medium leading-snug text-foreground ${artist ? 'text-center' : ''}`}>{title}</span>
      {sub && <span className={`mt-0.5 line-clamp-1 text-xs text-muted-foreground ${artist ? 'text-center' : ''}`}>{sub}</span>}
    </button>
  );
}
