import { useEffect, useMemo, useRef } from 'react';
import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { mangaListOptions } from '../../api/queries';
import type { MangaCard as Card, MangaListQuery } from '../../api/types';
import { flagLabel, galleryRoute, mangaHolder } from '../../lib/manga';
import { useHeaderWash } from '../../lib/wash';
import { Empty, ErrorState, Spinner } from '../States';
import { Skeleton } from '../ui';
import { MangaImage } from './MangaImage';

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-5 gap-y-9 sm:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]';

/**
 * One gallery, styled like the music cards: a page-shaped cover that darkens on hover with an open
 * button rising in its corner, the language badge, and the title on two lines.
 */
export function MangaCard({ card, style }: { card: Card; style?: React.CSSProperties }) {
  const flag = flagLabel(card.language);
  return (
    <Link to={galleryRoute(card.id)} title={card.title} className="group block min-w-0 rounded-xl focus-visible:outline-none" style={style}>
      <div className="relative">
        <MangaImage
          src={card.cover}
          fallbacks={card.coverFallbacks}
          alt=""
          className="aspect-[1/1.41] w-full rounded-xl shadow-lg shadow-black/40 ring-offset-background group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2"
          imgClassName="h-full w-full object-cover"
        />
        <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" aria-hidden />
        <span
          className="pointer-events-none absolute bottom-3 right-3 flex size-11 translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-md shadow-black/40 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
          aria-hidden
        >
          <BookOpen size={18} />
        </span>
        {flag && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-white backdrop-blur">
            {flag}
          </span>
        )}
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug text-foreground">{card.title}</p>
    </Link>
  );
}

export function MangaCardSkeletons({ count = 12 }: { count?: number }) {
  return (
    <div className={GRID} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[1/1.41] w-full rounded-xl" />
          <Skeleton className="mt-3 h-3.5 w-4/5" />
        </div>
      ))}
    </div>
  );
}

/** A gallery list that loads the next site page as you scroll. The page header takes its colour from the first cover. */
export function MangaGrid({ query, emptyText = 'No galleries found.' }: { query: MangaListQuery; emptyText?: string }) {
  const list = useInfiniteQuery(mangaListOptions(query));
  const cards = useMemo(() => {
    // The site's pages can overlap when new galleries arrive while you scroll.
    const seen = new Set<string>();
    return (list.data?.pages.flatMap((p) => p.items) ?? []).filter((c) => !seen.has(c.id) && !!seen.add(c.id));
  }, [list.data]);
  useHeaderWash(mangaHolder(cards[0]?.cover));

  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    }, { rootMargin: '600px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (list.isPending && list.fetchStatus !== 'idle') return <MangaCardSkeletons />;
  if (list.error && cards.length === 0) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  if (list.isSuccess && cards.length === 0) return <Empty title="Nothing here">{emptyText}</Empty>;

  return (
    <div>
      <div className={`stagger ${GRID}`}>
        {cards.map((card, i) => (
          <MangaCard key={card.id} card={card} style={{ '--i': i % 24 } as React.CSSProperties} />
        ))}
      </div>
      {list.error && cards.length > 0 && <ErrorState error={list.error} onRetry={() => void fetchNextPage()} />}
      {isFetchingNextPage && <Spinner label="Loading more" />}
      <div ref={sentinel} className="h-1" />
    </div>
  );
}
