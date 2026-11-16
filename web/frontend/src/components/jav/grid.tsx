import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { UseInfiniteQueryResult } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { ApiError } from '../../api/client';
import { Empty, ErrorState, Spinner } from '../States';
import { EmptyState, Skeleton } from '../ui';

export const MOVIE_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-5 gap-y-9 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]';
export const IDOL_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-5 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]';

/** Calls `load` when the returned element scrolls within 600px of the screen. */
export function useLoadMore(hasMore: boolean, busy: boolean, load: () => unknown) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !busy) void load();
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, busy, load]);
  return sentinel;
}

/** "Not available" for a list or page a content rule refuses (451). */
export function Unavailable({ what = 'This page' }: { what?: string }) {
  return (
    <EmptyState icon={Ban} title="Not available">
      {what} has content Echo doesn't show.
    </EmptyState>
  );
}

export const isRefused = (error: unknown) => error instanceof ApiError && error.status === 451;

/**
 * A grid that loads the next site page as you scroll, with skeletons, an empty state, and errors
 * (the first page's in place of the grid, a later page's under it).
 */
export function InfiniteGrid<T, P extends { items: T[] }>({
  list, items, itemKey, render, className, skeleton, emptyText,
}: {
  list: UseInfiniteQueryResult<{ pages: P[] }>;
  items: T[];
  itemKey: (item: T) => string;
  render: (item: T, index: number) => ReactNode;
  className: string;
  skeleton: ReactNode;
  emptyText: string;
}) {
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  const sentinel = useLoadMore(hasNextPage, isFetchingNextPage, fetchNextPage);
  if (list.isPending && list.fetchStatus !== 'idle') return <>{skeleton}</>;
  if (list.error && items.length === 0) {
    if (isRefused(list.error)) return <Unavailable what="This list" />;
    return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  }
  if (list.isSuccess && items.length === 0 && !hasNextPage) return <Empty title="Nothing here">{emptyText}</Empty>;
  return (
    <div>
      <div className={`stagger ${className}`}>
        {items.map((item, i) => (
          <div key={itemKey(item)} style={{ '--i': i % 24 } as React.CSSProperties} className="min-w-0">
            {render(item, i)}
          </div>
        ))}
      </div>
      {list.error && items.length > 0 && <ErrorState error={list.error} onRetry={() => void fetchNextPage()} />}
      {isFetchingNextPage && <Spinner label="Loading more" />}
      <div ref={sentinel} className="h-1" />
    </div>
  );
}

/** Placeholder cards in a grid. */
export function GridSkeletons({ className, aspect, count = 12, round = false }: { className: string; aspect: string; count?: number; round?: boolean }) {
  return (
    <div className={className} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className={`${aspect} w-full ${round ? 'rounded-full' : 'rounded-xl'}`} />
          <Skeleton className="mt-3 h-3.5 w-4/5" />
          <Skeleton className="mt-2 h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}
