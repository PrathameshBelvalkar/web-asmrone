import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { javMoviesOptions } from '../../api/queries';
import type { JavKind, JavMovieQuery, JavMovieSort } from '../../api/types';
import { DetailHero } from '../../components/DetailHero';
import { MovieGrid } from '../../components/jav/cards';
import { SearchBox } from '../../components/jav/SearchBox';
import { Segmented } from '../../components/manga/Segmented';
import { PageHeader } from '../../components/ui';
import { useCrumbs, useDetailCrumbs } from '../../lib/crumbs';
import { isJavListBy, JAV_HOME, LIST_BY_LABEL, searchRoute } from '../../lib/jav';
import { NotFoundPage } from '../NotFoundPage';

const KINDS: { value: JavKind; label: string }[] = [
  { value: 'censored', label: 'Censored' },
  { value: 'uncensored', label: 'Uncensored' },
];
const SORTS: { value: JavMovieSort; label: string }[] = [
  { value: 'release', label: 'Newest' },
  { value: 'most_favorited', label: 'Most favourited' },
  { value: 'top_rated', label: 'Top rated' },
];

/** Every movie, censored or uncensored, by release date, favourites or rating. */
export function JavMoviesPage() {
  useCrumbs([{ label: 'JAV', to: '/jav' }, { label: 'Movies' }]);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const kind: JavKind = params.get('kind') === 'uncensored' ? 'uncensored' : 'censored';
  const raw = params.get('sort');
  const sort: JavMovieSort = SORTS.some((s) => s.value === raw) ? (raw as JavMovieSort) : 'release';
  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const query: JavMovieQuery = { by: 'movies', kind, sort };

  return (
    <>
      <PageHeader title="Movies" meta="Newest release dates first, including announced titles." />
      <div className="mb-5 max-w-xl">
        <SearchBox
          scope="movies"
          source={{ type: 'movies', kind }}
          placeholder={kind === 'uncensored' ? 'Search uncensored movies' : 'Search movies or type a DVD ID'}
          onSubmit={(q) => navigate(searchRoute(q, 'movies', kind))}
          size="md"
        />
      </div>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Segmented<JavKind> label="Kind" value={kind} onChange={(v) => update('kind', v === 'censored' ? null : v)} options={KINDS} />
        <Segmented<JavMovieSort> label="Sort" value={sort} onChange={(v) => update('sort', v === 'release' ? null : v)} options={SORTS} />
      </div>
      <MovieGrid key={JSON.stringify(query)} query={query} />
    </>
  );
}

/** The movies of one genre, studio or director. */
export function JavMovieListPage() {
  const { by = '', slug = '' } = useParams();
  const valid = isJavListBy(by) && slug.length > 0;
  const query: JavMovieQuery | null = valid ? { by, slug } : null;
  // Same query and cache as the grid below; read here for the name.
  const list = useInfiniteQuery({ ...javMoviesOptions(query ?? { by: 'genre', slug: '' }), enabled: !!query });
  const name = list.data?.pages[0]?.heading ?? slug.replace(/-/g, ' ');
  const label = valid ? LIST_BY_LABEL[by] : '';
  useDetailCrumbs(name, [JAV_HOME, ...(by === 'genre' ? [{ label: 'Genres', to: '/jav/genres' }] : [])]);
  if (!query) return <NotFoundPage />;
  return (
    <>
      <DetailHero cover={null} shape="none" eyebrow={label} title={name} />
      <MovieGrid key={`${by}:${slug}`} query={query} />
    </>
  );
}
