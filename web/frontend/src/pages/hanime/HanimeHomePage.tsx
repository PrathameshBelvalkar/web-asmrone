import { useQuery } from '@tanstack/react-query';
import { hanimeHomeOptions } from '../../api/queries';
import { Shelf, ShelfSkeleton, StatusLine } from '../../components/hanime/cards';
import { ErrorState } from '../../components/States';
import { PageHeader } from '../../components/ui';
import { useCrumbs } from '../../lib/crumbs';

/** New uploads, Trending, Most viewed, Top rated, and the most used tags, as rows. */
export function HanimeHomePage() {
  useCrumbs([{ label: 'Hentai' }]);
  const home = useQuery(hanimeHomeOptions());
  return (
    <>
      <PageHeader title="Hentai" meta={<StatusLine />} />
      {home.error && <ErrorState error={home.error} onRetry={() => void home.refetch()} />}
      {home.isPending && Array.from({ length: 3 }).map((_, i) => <ShelfSkeleton key={i} />)}
      {home.data?.map((shelf) => <Shelf key={shelf.key} shelf={shelf} />)}
    </>
  );
}
