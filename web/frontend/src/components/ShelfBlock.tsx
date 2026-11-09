import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, ChevronRight as Arrow, Folder } from 'lucide-react';
import type { CategoryDto, FeedEntry, MediaItem, ShelfDto, Track } from '../api/types';
import { kindOf, titleOf } from '../lib/media';
import { isTrackEntry, openMedia } from '../lib/actions';
import { playQueue } from '../player/engine';
import { Cover } from './Cover';
import { MediaCard } from './MediaCard';
import { TrackRow } from './TrackRow';
import { Chip, IconButton } from './ui';

const CHIP_LIMIT = 40;

/** One shelf from the server: a row of items, a track list, or category chips. */
export function ShelfBlock({ shelf }: { shelf: ShelfDto }) {
  switch (shelf.kind) {
    case 'items':
    case 'tracks':
      return <MediaRow title={shelf.title} subtitle={shelf.subtitle} items={(shelf.items ?? []) as MediaItem[]} moreFeedId={shelf.moreFeedId} />;
    case 'categories':
      return <CategoryGrid title={shelf.title} subtitle={shelf.subtitle} categories={shelf.categories ?? []} />;
    case 'item':
      return shelf.item ? <SingleEntry entry={shelf.item} /> : null;
    case 'category':
      return shelf.category ? <FolderList folders={[shelf.category]} /> : null;
    default:
      return null;
  }
}

export function SectionHeader({ title, subtitle, moreFeedId }: { title: string; subtitle?: string | null; moreFeedId?: string | null }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {moreFeedId && (
        <Link to={`/feed/${encodeURIComponent(moreFeedId)}`} state={{ title }} className="inline-flex shrink-0 items-center gap-0.5 text-sm text-foreground/80 transition hover:text-primary">
          See all <Arrow size={15} aria-hidden />
        </Link>
      )}
    </div>
  );
}

function MediaRow({ title, subtitle, items, moreFeedId }: { title: string; subtitle?: string | null; items: MediaItem[]; moreFeedId?: string | null }) {
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  if (!items.length) return null;
  const tracks = items.filter((i): i is Track => kindOf(i) === 'Track');
  const allTracks = tracks.length === items.length;

  const scrollBy = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * 480, behavior: 'smooth' });

  return (
    <section className="mb-12">
      <SectionHeader title={title} subtitle={subtitle} moreFeedId={moreFeedId} />
      {allTracks ? (
        <div className="-mx-2">
          {tracks.map((t, i) => (
            <TrackRow key={`${t.id}-${i}`} track={t} index={i} onPlay={() => playQueue(tracks, i)} />
          ))}
        </div>
      ) : (
        <div className="group/row relative">
          <div ref={scroller} className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2">
            {items.map((item, i) =>
              kindOf(item) === 'Track' ? (
                <TrackCard key={`${item.id}-${i}`} track={item as Track} onPlay={() => playQueue(tracks, tracks.indexOf(item as Track))} />
              ) : (
                <MediaCard key={`${item.id}-${i}`} item={item} onClick={() => openMedia(item, navigate)} />
              ),
            )}
          </div>
          <div className="absolute right-6 top-[38%] hidden gap-2 opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 md:flex">
            <IconButton icon={ChevronLeft} label="Scroll left" size="sm" className="bg-muted/90 backdrop-blur hover:bg-accent" onClick={() => scrollBy(-1)} />
            <IconButton icon={ChevronRight} label="Scroll right" size="sm" className="bg-muted/90 backdrop-blur hover:bg-accent" onClick={() => scrollBy(1)} />
          </div>
        </div>
      )}
    </section>
  );
}

function TrackCard({ track, onPlay }: { track: Track; onPlay: () => void }) {
  return (
    <button type="button" onClick={onPlay} className="group flex w-36 shrink-0 snap-start flex-col text-left sm:w-44">
      <Cover holder={track.cover} className="aspect-square w-full shadow-md shadow-black/30 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-xl" rounded="rounded-lg" />
      <span className="mt-3 line-clamp-2 text-sm font-medium leading-snug text-foreground">{titleOf(track)}</span>
    </button>
  );
}

function CategoryGrid({ title, subtitle, categories }: { title: string; subtitle?: string | null; categories: CategoryDto[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? categories : categories.slice(0, CHIP_LIMIT);
  return (
    <section className="mb-12">
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="flex flex-wrap gap-2">
        {shown.map((c, i) =>
          c.feedId ? (
            <Chip key={`${c.id}-${i}`} to={`/feed/${encodeURIComponent(c.feedId)}`} state={{ title: c.title }}>
              {c.title}
            </Chip>
          ) : (
            <Chip key={`${c.id}-${i}`}>{c.title}</Chip>
          ),
        )}
      </div>
      {categories.length > CHIP_LIMIT && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-4 inline-flex items-center gap-1.5 text-sm text-foreground/80 transition hover:text-primary">
          {expanded ? <ChevronsDownUp size={15} aria-hidden /> : <ChevronsUpDown size={15} aria-hidden />}
          {expanded ? 'Show fewer' : `Show all ${categories.length}`}
        </button>
      )}
    </section>
  );
}

function SingleEntry({ entry }: { entry: FeedEntry }) {
  const navigate = useNavigate();
  if (!('mediaItemType' in entry)) return null;
  if (isTrackEntry(entry)) return <TrackRow track={entry} onPlay={() => playQueue([entry], 0)} />;
  return <MediaCard item={entry} onClick={() => openMedia(entry, navigate)} />;
}

/** Folders of a work as one list: the folder name, opened on click. */
export function FolderList({ folders }: { folders: CategoryDto[] }) {
  return (
    <section className="mb-12">
      <SectionHeader title="Folders" subtitle={`${folders.length} ${folders.length === 1 ? 'folder' : 'folders'}`} />
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-border">
        {folders.map((f, i) => (
          <li key={`${f.id}-${i}`}>
            {f.feedId ? (
              <Link
                to={`/feed/${encodeURIComponent(f.feedId)}`}
                state={{ title: f.title }}
                className="group flex items-center gap-3 px-4 py-3 transition duration-150 hover:bg-accent"
              >
                <Folder size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{f.title}</span>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground transition duration-150 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3">
                <Folder size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground/80">{f.title}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
