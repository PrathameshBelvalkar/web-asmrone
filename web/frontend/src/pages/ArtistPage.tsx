import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { artistFeedOptions } from '../api/queries';
import type { Artist } from '../api/types';
import { DetailHero } from '../components/DetailHero';
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
      <DetailHero
        cover={artist.cover}
        shape="round"
        eyebrow="Artist"
        title={artist.name}
      >
        {artist.bio && <p className="mt-5 line-clamp-3 max-w-2xl text-sm leading-relaxed text-foreground/75">{artist.bio}</p>}
      </DetailHero>
      {feed.isPending && <CardSkeletons count={6} />}
      {feed.error && <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />}
      {feed.data && <FeedView feed={feed.data} playable onExpired={() => void feed.refetch()} emptyText="No works found." />}
    </>
  );
}
