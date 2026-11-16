import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { javGenresOptions } from '../../api/queries';
import { ErrorState } from '../../components/States';
import { PageHeader, Skeleton } from '../../components/ui';
import { useCrumbs } from '../../lib/crumbs';
import { listRoute } from '../../lib/jav';

/** The genres, one group per section, with a box that narrows them as you type. */
export function JavGenresPage() {
  useCrumbs([{ label: 'JAV', to: '/jav' }, { label: 'Genres' }]);
  const genres = useQuery(javGenresOptions());
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  const groups = (genres.data?.groups ?? [])
    .map((g) => ({ ...g, genres: needle ? g.genres.filter((x) => x.name.toLowerCase().includes(needle)) : g.genres }))
    .filter((g) => g.genres.length > 0);

  return (
    <>
      <PageHeader title="Genres" />
      <label className="relative mb-10 block max-w-md">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter genres"
          aria-label="Filter genres"
          className="h-11 w-full rounded-full border border-input bg-card pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </label>

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
