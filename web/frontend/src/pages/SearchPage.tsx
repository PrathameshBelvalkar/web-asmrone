import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { quickSearchOptions, searchOptions } from '../api/queries';
import type { QuickSearchItem } from '../api/types';
import { FeedView } from '../components/FeedView';
import { CardSkeletons, ErrorState } from '../components/States';
import { IconButton, PageHeader } from '../components/ui';
import { openMedia } from '../lib/actions';
import { artistsOf, titleOf } from '../lib/media';
import { useCrumbs } from '../lib/crumbs';

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const submitted = params.get('q') ?? '';
  useCrumbs(
    submitted
      ? [{ label: 'Home', to: '/' }, { label: 'Search', to: '/search' }, { label: `“${submitted}”` }]
      : [{ label: 'Home', to: '/' }, { label: 'Search' }],
  );
  const [text, setText] = useState(submitted);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(text.trim(), 250);

  const suggestions = useQuery({ ...quickSearchOptions(debounced), enabled: debounced.length > 0 && debounced !== submitted });
  const results = useQuery(searchOptions(submitted));
  const items = suggestions.data ?? [];

  const commit = (q: string) => {
    const value = q.trim();
    setText(value);
    setOpen(false);
    setActive(-1);
    if (value) setParams({ q: value });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    commit(text);
  };

  const pick = (item: QuickSearchItem) => {
    if ('query' in item) commit(item.query);
    else {
      setOpen(false);
      openMedia(item.media, navigate);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <>
      <PageHeader title="Search" />
      <form onSubmit={submit} className="relative mb-10" role="search">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="Works, circles, voice actors, or $tag:Name$"
          aria-label="Search"
          aria-autocomplete="list"
          aria-expanded={open && items.length > 0}
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
              setOpen(false);
              inputRef.current?.focus();
            }}
          />
        )}
        {open && text.trim() && items.length > 0 && (
          <ul role="listbox" className="scroll-thin absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-input bg-muted p-1.5 shadow-2xl shadow-black/50">
            {items.map((item, i) => {
              const label = 'query' in item ? item.query.trim() : `${titleOf(item.media)}`;
              const sub = 'query' in item ? 'Search' : artistsOf(item.media);
              return (
                <li key={i} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(item)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${i === active ? 'bg-accent text-foreground' : 'text-foreground/80 hover:bg-accent hover:text-foreground'}`}
                  >
                    <span className="min-w-0 truncate">{label}</span>
                    <span className="shrink-0 truncate text-xs text-muted-foreground">{sub}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </form>

      {!submitted && (
        <p className="text-sm text-muted-foreground">Search by work title, circle or voice actor. Tags such as <span className="text-foreground/80">$tag:ASMR$</span> work too.</p>
      )}
      {submitted && results.isPending && <CardSkeletons count={8} />}
      {results.error && <ErrorState error={results.error} onRetry={() => void results.refetch()} />}
      {results.data && <FeedView feed={results.data} emptyText={`No results for “${submitted}”.`} />}
    </>
  );
}
