import { FormEvent, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search, X } from 'lucide-react';
import { IdolGrid, MovieGrid } from '../../components/jav/cards';
import { Segmented } from '../../components/manga/Segmented';
import { IconButton, PageHeader } from '../../components/ui';
import { useCrumbs } from '../../lib/crumbs';
import { dvdIdSlug, movieRoute } from '../../lib/jav';

type Target = 'movies' | 'idols';

/** Search movies (by title or DVD ID) or idols (by name). Searches run on Enter. */
export function JavSearchPage() {
  const [params, setParams] = useSearchParams();
  const submitted = params.get('q') ?? '';
  const target: Target = params.get('type') === 'idols' ? 'idols' : 'movies';
  useCrumbs(
    submitted
      ? [{ label: 'JAV', to: '/jav' }, { label: 'Search', to: '/jav/search' }, { label: `“${submitted}”` }]
      : [{ label: 'JAV', to: '/jav' }, { label: 'Search' }],
  );
  const [text, setText] = useState(submitted);
  const inputRef = useRef<HTMLInputElement>(null);

  const go = (q: string, to: Target, replace = false) => {
    const next: Record<string, string> = {};
    if (q) next.q = q;
    if (to !== 'movies') next.type = to;
    setParams(next, { replace });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (value) go(value, target);
  };
  // A search that looks like a DVD ID gets a shortcut to that movie.
  const dvd = target === 'movies' && submitted ? dvdIdSlug(submitted) : null;

  return (
    <>
      <PageHeader title="Search" />
      <div className="mb-5">
        <Segmented<Target>
          label="Search for"
          value={target}
          onChange={(to) => {
            go(text.trim(), to, true);
            inputRef.current?.focus();
          }}
          options={[
            { value: 'movies', label: 'Movies' },
            { value: 'idols', label: 'Idols' },
          ]}
        />
      </div>
      <form onSubmit={submit} className="relative mb-8" role="search">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={target === 'movies' ? 'Title or DVD ID, for example SAVR-1268' : 'Idol name'}
          aria-label={`Search ${target}`}
          maxLength={200}
          className="h-12 w-full rounded-full border border-input bg-card pl-11 pr-12 text-base text-foreground placeholder:text-muted-foreground transition focus:border-primary focus:outline-none"
        />
        {text && (
          <IconButton
            icon={X}
            label="Clear search"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={() => {
              setText('');
              inputRef.current?.focus();
            }}
          />
        )}
      </form>

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
          <MovieGrid key={`m:${submitted}`} query={{ by: 'search', q: submitted }} emptyText="No movies match this search." />
        ) : (
          <IdolGrid key={`i:${submitted}`} query={{ by: 'search', q: submitted }} emptyText="No idols match this search." />
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          {target === 'movies' ? 'Search by title, or type a DVD ID to jump straight to that movie.' : 'Search by name.'}
        </p>
      )}
    </>
  );
}
