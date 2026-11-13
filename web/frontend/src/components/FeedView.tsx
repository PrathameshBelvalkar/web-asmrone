import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { ApiError } from '../api/client';
import { pagesOptions } from '../api/queries';
import type { CategoryDto, FeedDto, FeedEntry, MediaItem, ShelfDto, Track } from '../api/types';
import { isTrackEntry, openMedia, playFeed } from '../lib/actions';
import { playQueue } from '../player/engine';
import { MediaCard } from './MediaCard';
import { FolderList, ShelfBlock } from './ShelfBlock';
import { TrackRow } from './TrackRow';
import { CardSkeletons, Empty, ErrorState, Spinner } from './States';
import { Button } from './ui';

type Block =
  | { type: 'shelf'; shelf: ShelfDto }
  | { type: 'tracks'; tracks: Track[] }
  | { type: 'media'; items: MediaItem[] }
  | { type: 'folders'; folders: CategoryDto[] };

/** Consecutive tracks become a list, other media a grid, shelves stay as blocks. */
/** A search or feed "item" shelf is one media item: unwrap it so it joins the grid. */
function unwrapItem(entry: FeedEntry): FeedEntry {
  return !('mediaItemType' in entry) && entry.kind === 'item' && entry.item ? entry.item : entry;
}

function groupEntries(rawEntries: FeedEntry[]): Block[] {
  const blocks: Block[] = [];
  for (const entry of rawEntries.map(unwrapItem)) {
    if (!('mediaItemType' in entry)) {
      const last = blocks[blocks.length - 1];
      if (entry.kind === 'category' && entry.category) {
        // Consecutive folder shelves become one list.
        if (last?.type === 'folders') last.folders.push(entry.category);
        else blocks.push({ type: 'folders', folders: [entry.category] });
      } else {
        blocks.push({ type: 'shelf', shelf: entry });
      }
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (isTrackEntry(entry)) {
      if (last?.type === 'tracks') last.tracks.push(entry);
      else blocks.push({ type: 'tracks', tracks: [entry] });
    } else {
      if (last?.type === 'media') last.items.push(entry);
      else blocks.push({ type: 'media', items: [entry] });
    }
  }
  return blocks;
}

/**
 * An opened feed: optional tabs, a play-all action, and pages loaded as you scroll.
 * If the server forgot the feed (410), [onExpired] asks the parent to reopen it.
 */
export function FeedView({
  feed, onTab, onExpired, playable = false, emptyText = 'Nothing here yet.',
}: {
  feed: FeedDto | undefined;
  onTab?: (tabId: string) => void;
  onExpired?: () => void;
  playable?: boolean;
  emptyText?: string;
}) {
  const navigate = useNavigate();
  const pagedId = feed?.pagedId ?? null;
  const pages = useInfiniteQuery(pagesOptions(pagedId));

  const expired = pages.error instanceof ApiError && pages.error.status === 410;
  useEffect(() => {
    if (expired) onExpired?.();
  }, [expired, onExpired]);

  const entries = useMemo(() => pages.data?.pages.flatMap((p) => p.items) ?? [], [pages.data]);
  const blocks = useMemo(() => groupEntries(entries), [entries]);

  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = pages;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver((list) => {
      if (list[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: '400px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const hasTracks = entries.some((e) => !('mediaItemType' in e) ? e.kind === 'tracks' || e.kind === 'items' : isTrackEntry(e));
  const tabs = feed?.tabs.filter((t) => !t.isSort) ?? [];
  const loadingFirst = !!pagedId && pages.isPending;

  return (
    <div>
      {(tabs.length > 0 || (playable && hasTracks)) && (
        <div className="mb-8 flex flex-wrap items-center gap-3">
          {tabs.length > 0 && (
            <div role="tablist" className="no-scrollbar -mx-1 flex max-w-full gap-2 overflow-x-auto px-1">
              {tabs.map((tab) => {
                const active = feed?.selectedTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => onTab?.(tab.id)}
                    className={`h-9 shrink-0 rounded-lg border px-4 text-sm font-medium transition duration-150 ${active ? 'border-transparent bg-white text-black' : 'border-white/10 bg-white/[0.08] text-foreground hover:bg-white/[0.14]'}`}
                  >
                    {tab.title}
                  </button>
                );
              })}
            </div>
          )}
          {playable && hasTracks && (
            <Button variant="primary" icon={Play} onClick={() => feed && playFeed(feed)}>
              Play all
            </Button>
          )}
        </div>
      )}

      {loadingFirst && <CardSkeletons />}
      {!feed?.pagedId && <Empty title="Nothing to show">{emptyText}</Empty>}
      {pages.error && !expired && <ErrorState error={pages.error} onRetry={() => void pages.refetch()} />}

      {blocks.map((block, bi) => {
        if (block.type === 'shelf') return <ShelfBlock key={`s-${bi}-${block.shelf.id}`} shelf={block.shelf} />;
        if (block.type === 'folders') return <FolderList key={`f-${bi}`} folders={block.folders} />;
        if (block.type === 'tracks') {
          return (
            <div key={`t-${bi}`} className="-mx-2 mb-10">
              {block.tracks.map((t, i) => (
                <TrackRow key={`${t.id}-${i}`} track={t} index={i} onPlay={() => playQueue(block.tracks, i)} />
              ))}
            </div>
          );
        }
        return (
          <div key={`m-${bi}`} className="stagger mb-10 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-5 gap-y-9 sm:grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))]">
            {block.items.map((item, i) => (
              <MediaCard key={`${item.id}-${i}`} item={item} fluid style={{ '--i': i % 24 } as React.CSSProperties} onClick={() => openMedia(item, navigate)} />
            ))}
          </div>
        );
      })}

      {entries.length === 0 && pagedId && !pages.isPending && !pages.error && <Empty title="Nothing here yet">{emptyText}</Empty>}
      {isFetchingNextPage && <Spinner label="Loading more" />}
      <div ref={sentinel} className="h-1" />
    </div>
  );
}
