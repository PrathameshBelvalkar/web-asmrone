import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { javMoviesOptions } from '../../api/queries';
import type { JavKind } from '../../api/types';
import { MovieCard, MovieGrid } from '../../components/jav/cards';
import { SearchBox } from '../../components/jav/SearchBox';
import { Segmented } from '../../components/manga/Segmented';
import { PageHeader, Skeleton } from '../../components/ui';
import { useCrumbs } from '../../lib/crumbs';
import { daysUntil, searchRoute } from '../../lib/jav';

const KINDS: { value: JavKind; label: string }[] = [
  { value: 'censored', label: 'Censored' },
  { value: 'uncensored', label: 'Uncensored' },
];

/**
 * The newest released movies, with a row of announced ones above them (soonest first). With
 * `?show=upcoming` the whole page lists the announced movies instead.
 */
export function JavLatestPage() {
  const [params, setParams] = useSearchParams();
  const kind: JavKind = params.get('kind') === 'uncensored' ? 'uncensored' : 'censored';
  const upcomingOnly = params.get('show') === 'upcoming';
  const navigate = useNavigate();
  useCrumbs(
    upcomingOnly
      ? [{ label: 'JAV', to: '/jav' }, { label: 'Latest', to: '/jav/latest' }, { label: 'Upcoming' }]
      : [{ label: 'JAV', to: '/jav' }, { label: 'Latest' }],
  );
  const setKind = (v: JavKind) => {
    const next = new URLSearchParams(params);
    if (v === 'censored') next.delete('kind');
    else next.set('kind', v);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title={upcomingOnly ? 'Upcoming' : 'Latest'}
        meta={
          upcomingOnly
            ? 'Announced movies, the soonest first.'
            : 'The newest released movies. The first visit takes a few seconds while Echo finds where released titles start.'
        }
      />
      <div className="mb-5 max-w-xl">
        <SearchBox
          scope="movies"
          source={{ type: 'movies', kind }}
          placeholder={kind === 'uncensored' ? 'Search uncensored movies' : 'Search movies or type a DVD ID'}
          onSubmit={(q) => navigate(searchRoute(q, 'movies', kind))}
          size="md"
        />
      </div>
      <div className="mb-8">
        <Segmented<JavKind> label="Kind" value={kind} onChange={setKind} options={KINDS} />
      </div>
      {upcomingOnly ? (
        <MovieGrid key={`upcoming:${kind}`} query={{ by: 'upcoming', kind }} emptyText="No announced movies right now." />
      ) : (
        <>
          <UpcomingShelf kind={kind} />
          <h2 className="mb-5 text-2xl font-semibold md:text-[28px]">Just released</h2>
          <MovieGrid key={`latest:${kind}`} query={{ by: 'latest', kind }} emptyText="No released movies found." />
        </>
      )}
    </>
  );
}

/** The first page of announced movies in a horizontal row, each with how many days are left. */
function UpcomingShelf({ kind }: { kind: JavKind }) {
  const list = useInfiniteQuery(javMoviesOptions({ by: 'upcoming', kind }));
  const items = list.data?.pages[0]?.items ?? [];
  if (list.isSuccess && items.length === 0) return null;
  if (list.error) return null;
  return (
    <section className="mb-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-semibold md:text-[28px]">Coming soon</h2>
        <Link
          to={`/jav/latest?show=upcoming${kind === 'uncensored' ? '&kind=uncensored' : ''}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          See all <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-5 overflow-x-auto px-1 pb-2">
        {list.isPending
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[147/200] w-36 shrink-0 rounded-xl sm:w-40" />)
          : items.map((card) => {
              const days = daysUntil(card.releaseDate);
              return (
                <div key={card.slug} className="w-36 shrink-0 sm:w-40">
                  <MovieCard card={card} />
                  {days !== null && <p className="mt-1 text-xs font-medium text-primary">{days === 0 ? 'Out today' : `In ${days} ${days === 1 ? 'day' : 'days'}`}</p>}
                </div>
              );
            })}
      </div>
    </section>
  );
}
