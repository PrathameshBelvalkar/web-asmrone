import { useCallback } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { CircleAlert } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { feedOptions } from '../api/queries';
import { FeedView } from '../components/FeedView';
import { CardSkeletons, ErrorState } from '../components/States';
import { EmptyState, PageHeader } from '../components/ui';
import { useCrumbs } from '../lib/crumbs';

/** A feed opened from "See all", a tag, or a folder. */
export function FeedPage() {
  const { feedId = '' } = useParams();
  const location = useLocation();
  const title = (location.state as { title?: string } | null)?.title ?? 'Browse';
  useCrumbs([{ label: 'Home', to: '/' }, { label: title }]);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab');
  const feed = useQuery(feedOptions(feedId, tab));
  const reopen = useCallback(() => void feed.refetch(), [feed]);
  const expired = feed.error instanceof ApiError && feed.error.status === 410;
  return (
    <>
      <PageHeader title={title} />
      {feed.isPending && <CardSkeletons count={8} />}
      {expired && (
        <EmptyState icon={CircleAlert} title="This list is no longer open" action={
          <Link to="/" className="inline-flex h-10 items-center rounded-full border px-5 text-sm hover:bg-accent">Back to home</Link>
        }>
          The server restarted or the list was idle for a long time. Go back and open it again.
        </EmptyState>
      )}
      {feed.error && !expired && <ErrorState error={feed.error} onRetry={reopen} />}
      {feed.data && (
        <FeedView feed={feed.data} playable onTab={(id) => setParams({ tab: id })} onExpired={reopen} />
      )}
    </>
  );
}
