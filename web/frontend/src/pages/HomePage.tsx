import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { homeOptions, pagesOptions } from '../api/queries';
import type { FeedEntry, ImageHolder } from '../api/types';
import { FeedView } from '../components/FeedView';
import { CardSkeletons, ErrorState } from '../components/States';
import { useCrumbs } from '../lib/crumbs';
import { useSource } from '../lib/source';
import { useHeaderWash } from '../lib/wash';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Late night listening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** The first artwork in the feed: a media item's cover, or the first one inside a shelf. */
function firstCover(entries: FeedEntry[]): ImageHolder | null {
  for (const entry of entries) {
    if ('mediaItemType' in entry) {
      if (entry.cover) return entry.cover;
      continue;
    }
    const inner = entry.item ?? entry.items?.find((i) => 'mediaItemType' in i && i.cover);
    if (inner && 'mediaItemType' in inner && inner.cover) return inner.cover;
  }
  return null;
}

export function HomePage() {
  useCrumbs([{ label: 'Home' }]);
  const source = useSource((s) => s.source);
  const home = useQuery(homeOptions(source));
  // Same query (and cache) as the FeedView below: only used to colour the header from the first cover.
  const pages = useInfiniteQuery(pagesOptions(home.data?.pagedId));
  const firstPage = pages.data?.pages[0]?.items ?? [];
  useHeaderWash(home.data?.background ?? firstCover(firstPage));

  return (
    <>
      <header className="mb-8 pt-2 sm:pt-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-foreground/60">Home</p>
        <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{greeting()}</h1>
      </header>
      {home.isPending && <CardSkeletons count={6} />}
      {home.error && <ErrorState error={home.error} onRetry={() => void home.refetch()} />}
      {home.data && <FeedView feed={home.data} onExpired={() => void home.refetch()} emptyText="Nothing to show yet." />}
    </>
  );
}
