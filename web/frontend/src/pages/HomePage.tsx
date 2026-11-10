import { useQuery } from '@tanstack/react-query';
import { homeOptions } from '../api/queries';
import { FeedView } from '../components/FeedView';
import { CardSkeletons, ErrorState } from '../components/States';
import { PageHeader } from '../components/ui';
import { useCrumbs } from '../lib/crumbs';
import { useSource } from '../lib/source';

export function HomePage() {
  useCrumbs([{ label: 'Home' }]);
  const source = useSource((s) => s.source);
  const home = useQuery(homeOptions(source));
  return (
    <>
      <PageHeader title="Home" />
      {home.isPending && <CardSkeletons count={6} />}
      {home.error && <ErrorState error={home.error} onRetry={() => void home.refetch()} />}
      {home.data && <FeedView feed={home.data} onExpired={() => void home.refetch()} emptyText="Nothing to show yet." />}
    </>
  );
}
