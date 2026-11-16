import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock, LoaderCircle, Search, X } from 'lucide-react';
import { javSuggestOptions } from '../../api/queries';
import type { JavKind } from '../../api/types';
import { dvdIdSlug, idolRoute, movieRoute } from '../../lib/jav';
import { JavImage } from './JavImage';

/** One row of the suggestion list. */
export interface Suggestion {
  key: string;
  label: string;
  sub?: string;
  image?: string | null;
  /** Round picture (idols). */
  round?: boolean;
  /** Where picking it goes. Without one, picking it searches for `label`. */
  to?: string;
}

/**
 * Where suggestions come from: the site's movie or idol search (a request per pause in typing), or a
 * list the page already has (instant).
 */
export type SuggestSource =
  | { type: 'movies'; kind?: JavKind }
  | { type: 'idols' }
  | { type: 'local'; items: Suggestion[] };

const MAX_RECENT = 6;
const DEBOUNCE_MS = 300;

function readRecent(scope: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`echo:jav:recent:${scope}`) ?? '[]');
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function writeRecent(scope: string, list: string[]): void {
  try {
    localStorage.setItem(`echo:jav:recent:${scope}`, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // Storage can be refused (private windows); recent searches just aren't kept.
  }
}

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/**
 * A search field with suggestions. Empty, it lists recent searches; typed into, it lists matches with
 * pictures and ends with "Search for …". ↑ and ↓ move through the list, Enter picks, Esc closes.
 */
export function SearchBox({
  scope, source, placeholder, initial = '', onSubmit, onTextChange, autoFocus = false, size = 'lg',
}: {
  /** Names the recent-search list, so each page keeps its own. */
  scope: string;
  source: SuggestSource;
  placeholder: string;
  initial?: string;
  /** Called with the text when it is searched for (Enter, or "Search for …"). */
  onSubmit: (q: string) => void;
  /** Called on every change, for pages that filter as you type. */
  onTextChange?: (text: string) => void;
  autoFocus?: boolean;
  size?: 'md' | 'lg';
}) {
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState(() => readRecent(scope));
  const q = text.trim();
  const debounced = useDebounced(q, DEBOUNCE_MS);

  // A new address (Back, a link) brings its own query.
  useEffect(() => setText(initial), [initial]);

  const remote = source.type === 'local' ? null : source;
  const suggest = useQuery({
    ...javSuggestOptions(remote?.type ?? 'movies', debounced, remote?.type === 'movies' ? remote.kind : undefined),
    enabled: remote !== null && debounced.length >= 2,
  });

  const rows: Suggestion[] = useMemo(() => {
    if (q.length === 0) return recent.map((r) => ({ key: `recent:${r}`, label: r }));
    const out: Suggestion[] = [];
    if (source.type === 'movies') {
      const dvd = dvdIdSlug(q);
      if (dvd && source.kind !== 'uncensored') {
        out.push({ key: `dvd:${dvd}`, label: `Go to ${dvd.toUpperCase()}`, to: movieRoute('censored', dvd) });
      }
    }
    if (source.type === 'local') {
      const needle = q.toLowerCase();
      out.push(...source.items.filter((s) => s.label.toLowerCase().includes(needle)).slice(0, 8));
    } else if (q.length >= 2) {
      const data = suggest.data;
      for (const m of data?.movies ?? []) {
        out.push({
          key: `m:${m.kind}:${m.slug}`,
          label: m.dvdId ?? m.title,
          sub: m.dvdId ? m.title : m.studio?.name,
          image: m.cover,
          to: movieRoute(m.kind, m.slug),
        });
      }
      for (const i of data?.idols ?? []) {
        out.push({ key: `i:${i.slug}`, label: i.name, sub: i.age !== null ? `Age ${i.age}` : undefined, image: i.photo, round: true, to: idolRoute(i.slug) });
      }
    }
    out.push({ key: 'submit', label: `Search for “${q}”` });
    return out;
  }, [q, recent, source, suggest.data]);

  useEffect(() => setActive(-1), [q]);

  const remember = (value: string) => {
    const next = [value, ...recent.filter((r) => r.toLowerCase() !== value.toLowerCase())].slice(0, MAX_RECENT);
    setRecent(next);
    writeRecent(scope, next);
  };

  const submit = (value: string) => {
    const v = value.trim();
    if (!v) return;
    remember(v);
    setOpen(false);
    inputRef.current?.blur();
    onSubmit(v);
  };

  const pick = (row: Suggestion) => {
    if (row.key === 'submit') return submit(q);
    if (row.key.startsWith('recent:')) {
      setText(row.label);
      onTextChange?.(row.label);
      return submit(row.label);
    }
    if (q) remember(q);
    setOpen(false);
    if (row.to) navigate(row.to);
    else submit(row.label);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    } else if (e.key === 'Enter' && open && active >= 0 && rows[active]) {
      e.preventDefault();
      pick(rows[active]);
    }
  };

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(text);
  };

  const showList = open && rows.length > 0 && !(q.length === 0 && recent.length === 0);
  const loading = remote !== null && q.length >= 2 && (suggest.isFetching || debounced !== q);
  const height = size === 'lg' ? 'h-12 text-base' : 'h-10 text-sm';

  return (
    <form onSubmit={onFormSubmit} role="search" className="relative w-full">
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          onTextChange?.(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={200}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={`${height} w-full rounded-full border border-input bg-card pl-11 pr-20 text-foreground placeholder:text-muted-foreground transition focus:border-primary focus:outline-none`}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {loading && <LoaderCircle size={16} className="animate-spin text-muted-foreground" aria-label="Loading suggestions" />}
        {text && (
          <button
            type="button"
            aria-label="Clear search"
            // Keep focus in the field.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setText('');
              onTextChange?.('');
              inputRef.current?.focus();
            }}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </div>

      {showList && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-popover shadow-2xl shadow-black/60">
          {q.length === 0 && (
            <div className="flex items-center justify-between px-4 pb-1 pt-3 text-xs text-muted-foreground">
              <span>Recent searches</span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setRecent([]);
                  writeRecent(scope, []);
                }}
                className="hover:text-foreground"
              >
                Clear
              </button>
            </div>
          )}
          <ul id={listId} role="listbox" className="max-h-[22rem] overflow-y-auto py-1.5">
            {rows.map((row, i) => (
              <li
                key={row.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // Pick on mousedown, before the field's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(row);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm ${i === active ? 'bg-white/10' : ''}`}
              >
                <RowIcon row={row} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{row.label}</span>
                  {row.sub && <span className="block truncate text-xs text-muted-foreground">{row.sub}</span>}
                </span>
                {row.to && <ArrowRight size={14} className="shrink-0 text-muted-foreground" aria-hidden />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

function RowIcon({ row }: { row: Suggestion }) {
  if (row.key.startsWith('recent:')) return <Clock size={16} className="shrink-0 text-muted-foreground" aria-hidden />;
  if (row.key === 'submit') return <Search size={16} className="shrink-0 text-muted-foreground" aria-hidden />;
  if (row.image === undefined) return <ArrowRight size={16} className="shrink-0 text-primary" aria-hidden />;
  return (
    <JavImage
      src={row.image}
      className={`shrink-0 ${row.round ? 'size-9 rounded-full' : 'h-11 w-8 rounded-md'}`}
      imgClassName="h-full w-full object-cover object-top"
    />
  );
}
