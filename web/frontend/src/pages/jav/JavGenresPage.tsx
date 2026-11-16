import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { javGenresOptions } from '../../api/queries';
import { ErrorState } from '../../components/States';
import { PageHeader, Skeleton } from '../../components/ui';
import { useCrumbs } from '../../lib/crumbs';
import { listRoute } from '../../lib/jav';
import { SearchBox } from '../../components/jav/SearchBox';

/** The genres, one group per section, with a box that narrows them as you type. */
export function JavGenresPage() {
  useCrumbs([{ label: 'JAV', to: '/jav' }, { label: 'Genres' }]);
  const genres = useQuery(javGenresOptions());
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  // Every genre once (Top Genres repeats some), for the suggestions.
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    return (genres.data?.groups ?? [])
      .flatMap((g) => g.genres.map((x) => ({ ...x, group: g.name })))
      .filter((x) => !seen.has(x.slug) && !!seen.add(x.slug))
      .map((x) => ({ key: x.slug, label: x.name, sub: x.group, to: listRoute('genre', x.slug) }));
  }, [genres.data]);
  const groups = (genres.data?.groups ?? [])
    .map((g) => ({ ...g, genres: needle ? g.genres.filter((x) => x.name.toLowerCase().includes(needle)) : g.genres }))
    .filter((g) => g.genres.length > 0);

  return (
    <>
      <PageHeader title="Genres" />
      <div className="mb-10 max-w-md">
        <SearchBox
          scope="genres"
          source={{ type: 'local', items: suggestions }}
          placeholder="Search genres"
          onSubmit={setFilter}
          onTextChange={setFilter}
          size="md"
        />
      </div>

      {genres.error && <ErrorState error={genres.error} onRetry={() => void genres.refetch()} />}
      {genres.isPending && (
        <div className="space-y-8" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-4 h-6 w-40" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 12 }).map((__, j) => (
                  <Skeleton key={j} className="h-8 w-24 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {genres.isSuccess && groups.length === 0 && <p className="text-sm text-muted-foreground">No genre matches “{filter.trim()}”.</p>}

      <div className="space-y-10">
        {groups.map((g) => (
          <section key={g.name}>
            <h2 className="mb-4 text-xl font-semibold">{g.name}</h2>
            <div className="flex flex-wrap gap-2">
              {g.genres.map((genre) => (
                <Link
                  key={genre.slug}
                  to={listRoute('genre', genre.slug)}
                  className="inline-flex h-8 items-center rounded-full border border-white/10 bg-white/[0.06] px-3.5 text-sm text-foreground/90 transition-colors hover:border-white/25 hover:bg-white/[0.12]"
                >
                  {genre.name}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
