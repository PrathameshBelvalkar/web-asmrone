import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Eye, RefreshCw } from 'lucide-react';
import { api } from '../../api/client';
import { hanimeStatusOptions, hanimeTitlesOptions } from '../../api/queries';
import type { HanimeBrowse, HanimeCard as Card, HanimeShelf } from '../../api/types';
import { browseRoute, timeAgo, titleRoute } from '../../lib/hanime';
import { formatCount } from '../../lib/manga';
import { toast } from '../../lib/toast';
import { messageFor } from '../../lib/errors';
import { GridSkeletons, InfiniteGrid } from '../jav/grid';
import { JavImage } from '../jav/JavImage';
import { Skeleton } from '../ui';

export const POSTER_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-5 gap-y-9 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]';
const BADGE = 'rounded-md bg-black/65 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-white backdrop-blur';

/** One title: the 2:3 cover art (as on hanime.tv) that darkens on hover, the name on two lines, the studio and year, and views. */
export function HanimeCard({ card }: { card: Card }) {
  return (
    <Link to={titleRoute(card.slug)} title={card.name} className="group block min-w-0 rounded-xl focus-visible:outline-none">
      <div className="relative">
        <JavImage
          src={card.cover}
          fallbacks={card.poster ? [card.poster] : undefined}
          className="aspect-[2/3] w-full rounded-xl shadow-lg shadow-black/40 ring-offset-background group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2"
        />
        <span
          className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden
        />
        <span className="absolute left-2.5 top-2.5 flex gap-1">
          {card.isNew && <span className={`${BADGE} bg-primary/90 text-primary-foreground`}>New</span>}
          {card.censorship === 'uncensored' && <span className={BADGE}>Uncensored</span>}
        </span>
        <span className={`${BADGE} absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 tnum`}>
          <Eye size={11} aria-hidden /> {formatCount(card.views)}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug text-foreground">{card.name}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {card.studio.name} · <span className="tnum">{card.releasedAt.slice(0, 4)}</span>
      </p>
    </Link>
  );
}

/** Browse's list: loads the next page as you scroll. */
export function HanimeGrid({ browse, emptyText = 'No titles match.' }: { browse: HanimeBrowse; emptyText?: string }) {
  const list = useInfiniteQuery(hanimeTitlesOptions(browse));
  const items = useMemo(() => {
    const seen = new Set<number>();
    return (list.data?.pages.flatMap((p) => p.items) ?? []).filter((c) => !seen.has(c.id) && !!seen.add(c.id));
  }, [list.data]);
  return (
    <InfiniteGrid
      list={list}
      items={items}
      itemKey={(c) => String(c.id)}
      render={(c) => <HanimeCard card={c} />}
      className={POSTER_GRID}
      skeleton={<GridSkeletons className={POSTER_GRID} aspect="aspect-[2/3]" />}
      emptyText={emptyText}
    />
  );
}

/** How many titles match, from the list's first page. */
export function useTotal(browse: HanimeBrowse): number | null {
  const list = useInfiniteQuery(hanimeTitlesOptions(browse));
  return list.data?.pages[0]?.total ?? null;
}

/** A row of titles with a "See all" link to Browse. */
export function Shelf({ shelf }: { shelf: HanimeShelf }) {
  if (shelf.items.length === 0) return null;
  return (
    <section className="mb-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-semibold md:text-[28px]">{shelf.title}</h2>
        <Link to={browseRoute(shelf.browse)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          See all <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-5 overflow-x-auto px-1 pb-2">
        {shelf.items.map((card) => (
          <div key={card.id} className="w-36 shrink-0 sm:w-40">
            <HanimeCard card={card} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ShelfSkeleton() {
  return (
    <div className="mb-12" aria-hidden>
      <Skeleton className="mb-5 h-7 w-48" />
      <div className="flex gap-5 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[2/3] w-36 shrink-0 rounded-xl sm:w-40" />
        ))}
      </div>
    </div>
  );
}

/** "Updated 12 min ago · 3,462 titles", a Refresh button, and a note while the source asks Echo to wait. */
export function StatusLine() {
  const client = useQueryClient();
  const status = useQuery(hanimeStatusOptions());
  const refresh = useMutation({
    mutationFn: () => api.hanime.sync(),
    onSuccess: (s) => {
      client.setQueryData(hanimeStatusOptions().queryKey, s);
      void client.invalidateQueries({ queryKey: ['hanime'] });
      toast(s.error ? s.error : 'Hentai catalog is up to date');
    },
    onError: (e) => toast(messageFor(e)),
  });
  const s = status.data;
  if (!s) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span>
        Updated {timeAgo(s.lastCheckedAt)} · <span className="tnum">{s.titles.toLocaleString('en')}</span> titles
      </span>
      {s.paused && <span className="text-amber-300">Paused: hanime asked Echo to wait</span>}
      <button
        type="button"
        onClick={() => refresh.mutate()}
        disabled={refresh.isPending || s.syncing}
        className="inline-flex items-center gap-1.5 text-foreground/80 hover:text-foreground disabled:opacity-50"
      >
        <RefreshCw size={14} className={refresh.isPending || s.syncing ? 'animate-spin' : ''} aria-hidden /> Refresh
      </button>
    </p>
  );
}
