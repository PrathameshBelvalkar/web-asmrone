import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Heart, ListMusic, LogIn } from 'lucide-react';
import { libraryOptions, meOptions } from '../api/queries';
import { FeedView } from '../components/FeedView';
import { CardSkeletons, ErrorState } from '../components/States';
import { EmptyState, PageHeader } from '../components/ui';
import { useCrumbs } from '../lib/crumbs';

export function LibraryPage() {
  useCrumbs([{ label: 'Home', to: '/' }, { label: 'Library' }]);
  const me = useQuery(meOptions());
  const library = useQuery({ ...libraryOptions(), enabled: !!me.data });

  if (me.isSuccess && !me.data) {
    return (
      <>
        <PageHeader title="Library" />
        <EmptyState icon={ListMusic} title="Log in to see your library" action={
          <Link to="/settings" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
            <LogIn size={16} aria-hidden /> Log in
          </Link>
        }>
          Your playlists and favourites from asmr.one appear here.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Library" meta={me.data ? <span className="inline-flex items-center gap-1.5"><Heart size={13} aria-hidden /> Signed in as {me.data.name}</span> : undefined} />
      {(me.isPending || library.isPending) && <CardSkeletons count={6} />}
      {library.error && <ErrorState error={library.error} onRetry={() => void library.refetch()} />}
      {library.data && <FeedView feed={library.data} onExpired={() => void library.refetch()} emptyText="Your library is empty." />}
    </>
  );
}
