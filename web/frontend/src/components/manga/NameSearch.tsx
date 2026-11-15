import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { mangaIndexSearchOptions } from '../../api/queries';
import type { MangaIndexKind } from '../../api/types';
import { formatCount, KIND_LABEL, tagRoute } from '../../lib/manga';
import { Empty, ErrorState, Spinner } from '../States';
import { IconButton } from '../ui';

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** A search box for tag, artist, character, parody or group names. Controlled by the page, which shows the results. */
export function NameSearchBox({
  kind, value, onChange, autoFocus = false, className = 'w-full max-w-md',
}: {
  kind: MangaIndexKind;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const label = `Search ${KIND_LABEL[kind].many.toLowerCase()}`;
  return (
    <div className={`relative ${className}`} role="search">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        maxLength={100}
        autoFocus={autoFocus}
        className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.06] pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-white/25 focus:bg-white/[0.09] focus:outline-none"
      />
      {value && (
        <IconButton
          icon={X}
          label="Clear"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2"
          onClick={() => {
            onChange('');
            ref.current?.focus();
          }}
        />
      )}
    </div>
  );
}

/** Names of `kind` containing `q`, each opening its gallery list. Waits until typing pauses. */
export function NameSearchResults({ kind, q }: { kind: MangaIndexKind; q: string }) {
  const debounced = useDebounced(q.trim(), 300);
  const results = useQuery(mangaIndexSearchOptions(kind, debounced));
  const label = KIND_LABEL[kind].many.toLowerCase();

  if (!debounced) return null;
  if (results.isPending) return <Spinner label={`Searching ${label}…`} />;
  if (results.error) return <ErrorState error={results.error} onRetry={() => void results.refetch()} />;
  if (results.data.items.length === 0) return <Empty title="No matches">No {label} contain “{debounced}”.</Empty>;

  return (
    <ul className="-mx-3 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label={`Matching ${label}`}>
      {results.data.items.map((t) => (
        <li key={`${t.kind}:${t.slug}`}>
          <Link
            to={tagRoute(t.kind, t.slug)}
            className="flex items-baseline justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.06]"
          >
            <span className="min-w-0 truncate">{t.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground tnum">{formatCount(t.count)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
