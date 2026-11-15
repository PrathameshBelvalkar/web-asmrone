import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { mangaIndexOptions } from '../../api/queries';
import type { MangaIndexKind } from '../../api/types';
import { NameSearchBox, NameSearchResults } from '../../components/manga/NameSearch';
import { Segmented } from '../../components/manga/Segmented';
import { Empty, ErrorState, RowSkeletons } from '../../components/States';
import { Button, PageHeader } from '../../components/ui';
import { useCrumbs } from '../../lib/crumbs';
import { formatCount, INDEX_KINDS, KIND_LABEL, tagRoute } from '../../lib/manga';

const LETTERS = ['#', ...'abcdefghijklmnopqrstuvwxyz'];

/** The kinds on the Tags page; artists have their own page. */
const TAG_PAGE_KINDS = INDEX_KINDS.filter((k) => k !== 'artist');

/**
 * A–Z lists with gallery counts and a name search. `/manga/tags` switches between tags, characters,
 * parodies and groups; `/manga/artists` passes `fixedKind="artist"`.
 */
export function MangaTagsPage({ fixedKind }: { fixedKind?: MangaIndexKind }) {
  const [params, setParams] = useSearchParams();
  const rawKind = fixedKind ?? params.get('kind') ?? 'tag';
  const kind: MangaIndexKind = (INDEX_KINDS as string[]).includes(rawKind) ? (rawKind as MangaIndexKind) : 'tag';
  const q = params.get('q') ?? '';
  const letter = params.get('letter');
  const sort = params.get('sort') === 'popular' ? 'popular' : 'az';
  const page = Math.max(1, Number(params.get('page')) || 1);
  useCrumbs([{ label: 'Manga & Doujinshi', to: '/manga' }, { label: KIND_LABEL[kind].many }]);

  const index = useQuery({ ...mangaIndexOptions(kind, letter, sort, page), placeholderData: keepPreviousData, enabled: !q });

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    if (!('page' in changes)) next.delete('page');
    // Typing replaces the history entry instead of adding one per letter.
    setParams(next, { replace: 'q' in changes });
  };

  const lastPage = index.data?.lastPage ?? page;

  return (
    <>
      <PageHeader
        title={KIND_LABEL[kind].many}
        meta="Search by name, or pick one from the list to see its galleries."
        actions={<NameSearchBox kind={kind} value={q} onChange={(v) => update({ q: v || null })} className="w-72 sm:w-80" />}
      />
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        {!fixedKind && (
          <Segmented<MangaIndexKind>
            label="List"
            value={kind}
            onChange={(v) => update({ kind: v, letter: null })}
            options={TAG_PAGE_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k].many }))}
          />
        )}
        {!q && (
          <Segmented<'az' | 'popular'>
            label="Order"
            value={sort}
            onChange={(v) => update({ sort: v === 'az' ? null : v })}
            options={[
              { value: 'az', label: 'A–Z' },
              { value: 'popular', label: 'Most galleries' },
            ]}
          />
        )}
      </div>

      {q ? (
        <NameSearchResults kind={kind} q={q} />
      ) : (
        <>
          <nav aria-label="First letter" className="mb-6 flex flex-wrap gap-1">
            <LetterButton active={letter === null} onClick={() => update({ letter: null })}>All</LetterButton>
            {LETTERS.map((l) => (
              <LetterButton key={l} active={letter === l} onClick={() => update({ letter: l })}>
                {l === '#' ? '#' : l.toUpperCase()}
              </LetterButton>
            ))}
          </nav>

          {index.isPending && <RowSkeletons count={8} />}
          {index.error && <ErrorState error={index.error} onRetry={() => void index.refetch()} />}
          {index.data && index.data.items.length === 0 && <Empty title="Nothing here">No names start with this letter.</Empty>}
          {index.data && index.data.items.length > 0 && (
            <ul className={`-mx-3 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${index.isPlaceholderData ? 'opacity-60' : ''}`}>
              {index.data.items.map((t) => (
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
          )}

          {index.data && lastPage > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button icon={ChevronLeft} disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground tnum">
                Page {page} of {lastPage}
              </span>
              <Button disabled={page >= lastPage} onClick={() => update({ page: String(page + 1) })}>
                Next <ChevronRight size={16} aria-hidden />
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function LetterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-8 min-w-8 rounded-lg px-2 text-sm font-medium transition-colors ${active ? 'bg-white text-black' : 'text-muted-foreground hover:bg-white/[0.1] hover:text-foreground'}`}
    >
      {children}
    </button>
  );
}
