import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { artistFeedOptions } from '../api/queries';
import type { Artist } from '../api/types';
import { Cover } from '../components/Cover';
import { FeedView } from '../components/FeedView';
import { CardSkeletons, ErrorState } from '../components/States';
import { EmptyState } from '../components/ui';
import { recall } from '../lib/media';
import { UserRound } from 'lucide-react';
import { useCrumbs } from '../lib/crumbs';

/** An artist (circle or voice actor). Needs the name, so it's opened from a link. */
export function ArtistPage() {
  const { id = '' } = useParams();
  const artist = recall<Artist>('Artist', id);
  useCrumbs([{ label: 'Home', to: '/' }, { label: artist?.name || 'Artist' }]);
  const feed = useQuery({ ...artistFeedOptions(artist ?? { mediaItemType: '', id, name: '', extras: {} }), enabled: !!artist });

  if (!artist) {
    return <EmptyState icon={UserRound} title="Open this artist from a work or search">Artist pages open from links on a work or a search result.</EmptyState>;
  }
  return (
    <>
      <section className="mb-10 flex flex-col items-center gap-5 sm:flex-row sm:items-end">
        <Cover holder={artist.cover} className="h-32 w-32 shrink-0 shadow-xl shadow-black/50 sm:h-40 sm:w-40" rounded="rounded-full" />
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Artist</p>
          <h1 className="mt-1 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{artist.name}</h1>
          {artist.bio && <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-relaxed text-foreground/80">{artist.bio}</p>}
        </div>
      </section>
      {feed.isPending && <CardSkeletons count={6} />}
      {feed.error && <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />}
      {feed.data && <FeedView feed={feed.data} playable onExpired={() => void feed.refetch()} emptyText="No works found." />}
    </>
  );
}
