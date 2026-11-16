import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { JavKind } from '../../api/types';
import { IdolGrid, MovieGrid } from '../../components/jav/cards';
import { SearchBox } from '../../components/jav/SearchBox';
import { Segmented } from '../../components/manga/Segmented';
import { PageHeader } from '../../components/ui';
import { useCrumbs } from '../../lib/crumbs';
import { dvdIdSlug, isJavKind, movieRoute } from '../../lib/jav';

type Target = 'movies' | 'idols';
type KindChoice = JavKind | 'all';

const KINDS: { value: KindChoice; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'censored', label: 'Censored' },
  { value: 'uncensored', label: 'Uncensored' },
];

/** Search movies (by title or DVD ID, optionally one kind) or idols (by name), with suggestions as you type. */
export function JavSearchPage() {
  const [params, setParams] = useSearchParams();
  const submitted = params.get('q') ?? '';
  const target: Target = params.get('type') === 'idols' ? 'idols' : 'movies';
  const rawKind = params.get('kind') ?? '';
  const kind: JavKind | undefined = isJavKind(rawKind) ? rawKind : undefined;
  useCrumbs(
    submitted
      ? [{ label: 'JAV', to: '/jav' }, { label: 'Search', to: '/jav/search' }, { label: `“${submitted}”` }]
      : [{ label: 'JAV', to: '/jav' }, { label: 'Search' }],
  );

  const go = (changes: { q?: string; type?: Target; kind?: KindChoice }, replace = false) => {
    const q = changes.q ?? submitted;
    const to = changes.type ?? target;
    const k = changes.kind ?? kind ?? 'all';
    const next: Record<string, string> = {};
    if (q) next.q = q;
    if (to !== 'movies') next.type = to;
    else if (k !== 'all') next.kind = k;
    setParams(next, { replace });
  };
  // A search that looks like a DVD ID gets a shortcut to that movie.
  const dvd = target === 'movies' && kind !== 'uncensored' && submitted ? dvdIdSlug(submitted) : null;

  return (
    <>
      <PageHeader title="Search" />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented<Target>
          label="Search for"
          value={target}
          onChange={(to) => go({ type: to }, true)}
          options={[
            { value: 'movies', label: 'Movies' },
            { value: 'idols', label: 'Idols' },
          ]}
        />
        {target === 'movies' && (
          <Segmented<KindChoice> label="Kind" value={kind ?? 'all'} onChange={(k) => go({ kind: k }, true)} options={KINDS} />
        )}
      </div>
      <div className="mb-8">
        <SearchBox
          key={target}
          scope={target}
          source={target === 'idols' ? { type: 'idols' } : { type: 'movies', kind }}
          placeholder={target === 'movies' ? 'Title or DVD ID, for example SAVR-1268' : 'Idol name'}
          initial={submitted}
          onSubmit={(q) => go({ q })}
          autoFocus={!submitted}
        />
      </div>

      {dvd && (
        <Link
          to={movieRoute('censored', dvd)}
          className="mb-8 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          Go to {dvd.toUpperCase()} <ArrowRight size={16} aria-hidden />
        </Link>
      )}

      {submitted ? (
        target === 'movies' ? (
          <MovieGrid
            key={`m:${kind ?? 'all'}:${submitted}`}
            query={{ by: 'search', q: submitted, kind }}
            emptyText="No movies match this search."
          />
        ) : (
          <IdolGrid key={`i:${submitted}`} query={{ by: 'search', q: submitted }} emptyText="No idols match this search." />
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          {target === 'movies'
            ? 'Suggestions appear as you type. Type a DVD ID to jump straight to that movie.'
            : 'Suggestions appear as you type.'}
        </p>
      )}
    </>
  );
}
