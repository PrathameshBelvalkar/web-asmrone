import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, Folder, Play } from 'lucide-react';
import type { CategoryDto, FeedEntry, MediaItem, ShelfDto, Track } from '../api/types';
import { artistsOf, imageUrl, isPlayable, kindOf, titleOf } from '../lib/media';
import { isTrackEntry, openMedia } from '../lib/actions';
import { playQueue } from '../player/engine';
import { usePlayer } from '../player/store';
import { Cover } from './Cover';
import { Equaliser } from './Equaliser';
import { MediaCard } from './MediaCard';
import { TrackMenu } from './TrackMenu';
import { TrackRow } from './TrackRow';
import { cn } from '@/lib/utils';

const TILE_LIMIT = 24;
/** Rows in the "Quick picks" grid of a track shelf. */
const QUICK_ROWS = 4;

/** One shelf from the server: a row of items, a track grid, or category tiles. */
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

/** Shelf title: a small muted eyebrow (the subtitle), the title, then "More" and the scroll arrows. */
export function SectionHeader({ title, subtitle, moreFeedId, actions }: { title: string; subtitle?: string | null; moreFeedId?: string | null; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {subtitle && <p className="mb-1 truncate text-sm text-muted-foreground">{subtitle}</p>}
        <h2 className="truncate text-2xl font-semibold text-foreground md:text-[28px]">{title}</h2>
      </div>
      {(actions || moreFeedId) && (
        <div className="flex shrink-0 items-center gap-2">
          {moreFeedId && (
            <Link
              to={`/feed/${encodeURIComponent(moreFeedId)}`}
              state={{ title }}
              className="inline-flex h-8 items-center rounded-full border border-white/15 px-4 text-sm font-medium text-foreground/90 transition-colors hover:border-white/30 hover:bg-white/10"
            >
              More
            </Link>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}

/** Which way a horizontal row can still scroll. Updates on scroll and resize. */
function useScrollEdges(ref: React.RefObject<HTMLDivElement | null>) {
  const [edges, setEdges] = useState({ left: false, right: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, [ref]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, [ref, update]);
  return edges;
}

function ScrollArrows({ edges, onScroll }: { edges: { left: boolean; right: boolean }; onScroll: (dir: 1 | -1) => void }) {
  if (!edges.left && !edges.right) return null;
  const cls = 'flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-foreground transition-colors hover:bg-white/15 disabled:pointer-events-none disabled:opacity-30';
  return (
    <div className="hidden gap-1.5 md:flex">
      <button type="button" aria-label="Scroll left" className={cls} disabled={!edges.left} onClick={() => onScroll(-1)}>
        <ChevronLeft size={18} aria-hidden />
      </button>
      <button type="button" aria-label="Scroll right" className={cls} disabled={!edges.right} onClick={() => onScroll(1)}>
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}

function MediaRow({ title, subtitle, items, moreFeedId }: { title: string; subtitle?: string | null; items: MediaItem[]; moreFeedId?: string | null }) {
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(scroller);
  if (!items.length) return null;
  const tracks = items.filter((i): i is Track => kindOf(i) === 'Track');
  const allTracks = tracks.length === items.length;

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    el?.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <section className="mb-12">
      <SectionHeader title={title} subtitle={subtitle} moreFeedId={moreFeedId} actions={<ScrollArrows edges={edges} onScroll={scrollBy} />} />
      {allTracks ? (
        // "Quick picks": compact rows in columns of four that scroll sideways.
        <div
          ref={scroller}
          className={cn(
            'no-scrollbar stagger -mx-2 grid snap-x snap-mandatory gap-x-4 overflow-x-auto',
            tracks.length > QUICK_ROWS ? 'grid-flow-col grid-rows-4 auto-cols-[minmax(17rem,85%)] sm:auto-cols-[minmax(19rem,24rem)]' : 'grid-cols-1',
          )}
        >
          {tracks.map((t, i) => (
            <QuickPick key={`${t.id}-${i}`} track={t} style={{ '--i': Math.floor(i / QUICK_ROWS) } as React.CSSProperties} onPlay={() => playQueue(tracks, i)} />
          ))}
        </div>
      ) : (
        <div ref={scroller} className="no-scrollbar stagger -mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-2">
          {items.map((item, i) =>
            kindOf(item) === 'Track' ? (
              <MediaCard key={`${item.id}-${i}`} item={item} style={{ '--i': i } as React.CSSProperties} onClick={() => playQueue(tracks, tracks.indexOf(item as Track))} />
            ) : (
              <MediaCard key={`${item.id}-${i}`} item={item} style={{ '--i': i } as React.CSSProperties} onClick={() => openMedia(item, navigate)} />
            ),
          )}
        </div>
      )}
    </section>
  );
}

/** A compact track row for the Quick picks grid: small cover with a play overlay, title and artist. */
function QuickPick({ track, onPlay, style }: { track: Track; onPlay: () => void; style?: React.CSSProperties }) {
  const playable = isPlayable(track);
  const current = usePlayer((s) => s.index >= 0 && s.queue[s.index]?.id === track.id);
  const playing = usePlayer((s) => s.playing);
  return (
    <div style={style} className={cn('group flex snap-start items-center gap-3 rounded-xl px-2 py-2 transition-colors', current ? 'bg-white/[0.08]' : 'hover:bg-white/[0.06]', !playable && 'opacity-50')}>
      <button type="button" onClick={onPlay} disabled={!playable} aria-label={`Play ${titleOf(track)}`} className="relative size-12 shrink-0 disabled:cursor-not-allowed">
        <Cover holder={track.cover} className="size-12" rounded="rounded-lg" />
        <span className={cn('absolute inset-0 flex items-center justify-center rounded-lg bg-black/55 text-white transition-opacity', current && playing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')} aria-hidden>
          {current && playing ? <Equaliser /> : <Play size={18} fill="currentColor" />}
        </span>
      </button>
      <button type="button" onClick={onPlay} disabled={!playable} className="min-w-0 flex-1 text-left disabled:cursor-not-allowed">
        <span className={cn('block truncate text-sm font-medium', current ? 'text-primary' : 'text-foreground')}>{titleOf(track)}</span>
        <span className="block truncate text-[13px] text-muted-foreground">{artistsOf(track)}</span>
      </button>
      <TrackMenu track={track} label={`More options for ${titleOf(track)}`} />
    </div>
  );
}

/** Categories as "Moods & genres" tiles; their art, if any, sits in the corner. */
function CategoryGrid({ title, subtitle, categories }: { title: string; subtitle?: string | null; categories: CategoryDto[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? categories : categories.slice(0, TILE_LIMIT);
  return (
    <section className="mb-12">
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="stagger grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
        {shown.map((c, i) => (
          <CategoryTile key={`${c.id}-${i}`} category={c} index={i} />
        ))}
      </div>
      {categories.length > TILE_LIMIT && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-5 inline-flex h-8 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-medium text-foreground/90 transition-colors hover:bg-white/10">
          {expanded ? <ChevronsDownUp size={15} aria-hidden /> : <ChevronsUpDown size={15} aria-hidden />}
          {expanded ? 'Show fewer' : `Show all ${categories.length}`}
        </button>
      )}
    </section>
  );
}

function CategoryTile({ category: c, index }: { category: CategoryDto; index: number }) {
  // The server's colour when it sends one; otherwise a plain raised surface, so the art carries the colour.
  const background = c.backgroundColor || undefined;
  const art = imageUrl(c.image);
  const body = (
    <>
      <span className="relative z-10 line-clamp-2 text-sm font-medium leading-tight text-white">{c.title}</span>
      {c.subtitle && <span className="relative z-10 mt-0.5 block text-xs tabular-nums text-white/70">{c.subtitle}</span>}
      {art && <Cover holder={c.image} className="absolute bottom-2 right-2 size-16 shadow-md shadow-black/40" rounded="rounded-md" />}
    </>
  );
  const cls = 'group relative block h-20 overflow-hidden rounded-xl bg-white/[0.06] p-4 pr-20 text-left ring-1 ring-white/[0.08] transition-[filter,background-color] duration-150 hover:bg-white/10 hover:brightness-110';
  const style = { background, '--i': index } as React.CSSProperties;
  return c.feedId ? (
    <Link to={`/feed/${encodeURIComponent(c.feedId)}`} state={{ title: c.title }} className={cls} style={style}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={style}>{body}</div>
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
      <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-border bg-white/[0.03]">
        {folders.map((f, i) => (
          <li key={`${f.id}-${i}`}>
            {f.feedId ? (
              <Link
                to={`/feed/${encodeURIComponent(f.feedId)}`}
                state={{ title: f.title }}
                className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-white/[0.06]"
              >
                <Folder size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{f.title}</span>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-foreground" aria-hidden />
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
