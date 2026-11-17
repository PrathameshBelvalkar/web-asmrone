import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { hanimeStudiosOptions, hanimeTagsOptions } from '../../api/queries';
import type { HanimeBrowse, HanimeCensorship, HanimeSort } from '../../api/types';
import { HanimeGrid, useTotal } from '../../components/hanime/cards';
import { FilterSheet } from '../../components/hanime/FilterSheet';
import { Segmented } from '../../components/manga/Segmented';
import { PageHeader } from '../../components/ui';
import { useCrumbs } from '../../lib/crumbs';
import { browseFromParams, browseToParams, HANIME_HOME, RELEVANCE, SORTS, tagLabel } from '../../lib/hanime';

const CENSORSHIP: { value: 'all' | HanimeCensorship; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'censored', label: 'Censored' },
  { value: 'uncensored', label: 'Uncensored' },
];

/**
 * Every title, filtered and sorted on the server's copy of the catalog. The choices live in the
 * address. With `search`, this is the Search page: the query comes from the top bar.
 */
export function HanimeBrowsePage({ search = false }: { search?: boolean }) {
  const [params, setParams] = useSearchParams();
  const browse = browseFromParams(params, search);
  const update = (next: HanimeBrowse) => setParams(browseToParams(next), { replace: true });
  const total = useTotal(browse);
  const title = useTitle(browse, search);
  useCrumbs([HANIME_HOME, { label: title }]);

  const sorts = browse.q ? [RELEVANCE, ...SORTS] : SORTS;
  return (
    <>
      <PageHeader
        title={title}
        meta={total === null ? ' ' : `${total.toLocaleString('en')} ${total === 1 ? 'title' : 'titles'}`}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented<HanimeSort>
          label="Sort"
          value={browse.sort}
          onChange={(sort) => update({ ...browse, sort, order: sort === 'name' ? 'asc' : 'desc' })}
          options={sorts}
        />
      </div>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Segmented<'all' | HanimeCensorship>
          label="Censorship"
          value={browse.censored}
          onChange={(censored) => update({ ...browse, censored })}
          options={CENSORSHIP}
        />
        {browse.sort !== 'relevance' && (
          <button
            type="button"
            onClick={() => update({ ...browse, order: browse.order === 'asc' ? 'desc' : 'asc' })}
            aria-label={browse.order === 'asc' ? 'Ascending order' : 'Descending order'}
            title={browse.order === 'asc' ? 'Ascending' : 'Descending'}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.08] hover:bg-white/[0.14]"
          >
            {browse.order === 'asc' ? <ArrowUpNarrowWide size={16} aria-hidden /> : <ArrowDownWideNarrow size={16} aria-hidden />}
          </button>
        )}
        <FilterSheet browse={browse} onChange={update} />
      </div>
      {search && !browse.q ? (
        <p className="text-sm text-muted-foreground">Type in the search box above to search titles in every language.</p>
      ) : (
        <HanimeGrid key={JSON.stringify(browse)} browse={browse} emptyText={browse.q ? `Nothing matches “${browse.q}”.` : 'No titles match these filters.'} />
      )}
    </>
  );
}

/** The page title: the one tag, studio or series picked, the search, or Browse. */
function useTitle(b: HanimeBrowse, search: boolean): string {
  const tags = useQuery(hanimeTagsOptions());
  const studios = useQuery(hanimeStudiosOptions());
  if (search) return b.q ? `“${b.q}”` : 'Search';
  const only = b.tags.length + b.studios.length + (b.series ? 1 : 0) === 1 && !b.q;
  if (only && b.tags[0]) {
    const tag = tags.data?.flatMap((g) => g.tags).find((t) => t.slug === b.tags[0]);
    return tagLabel(tag?.name ?? b.tags[0].replace(/-/g, ' '));
  }
  if (only && b.studios[0]) return studios.data?.find((s) => s.slug === b.studios[0])?.name ?? b.studios[0].replace(/-/g, ' ');
  if (only && b.series) return tagLabel(b.series);
  return b.q ? `“${b.q}”` : 'Browse';
}
