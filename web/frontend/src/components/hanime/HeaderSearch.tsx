import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hanimeStudiosOptions, hanimeTagsOptions } from '../../api/queries';
import { searchRoute, studioRoute, tagLabel, tagRoute } from '../../lib/hanime';
import { SearchBox, type Suggestion, type SuggestSource } from '../jav/SearchBox';

type Area = 'browse' | 'search' | 'catalog';

/** Which search a Hanime page's top bar offers. */
export function hanimeSearchArea(pathname: string): Area {
  if (pathname === '/hentai/browse') return 'browse';
  if (pathname === '/hentai/search') return 'search';
  return 'catalog';
}

/**
 * The top bar's search on Hanime pages. Browse narrows its tags and studios as you type (`?q=`);
 * elsewhere it suggests titles, series, tags and studios from the catalog and opens the Search page.
 */
export function HanimeHeaderSearch() {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const area = hanimeSearchArea(pathname);
  const filtersPage = area === 'browse';
  // The same queries the Browse page runs, so their data is shared, not fetched twice.
  const tags = useQuery({ ...hanimeTagsOptions(), enabled: filtersPage });
  const studios = useQuery({ ...hanimeStudiosOptions(), enabled: filtersPage });

  const local: Suggestion[] = useMemo(() => {
    if (!filtersPage) return [];
    return [
      ...(tags.data ?? []).flatMap((g) =>
        g.tags.map((t) => ({ key: `t:${t.slug}`, label: tagLabel(t.name), sub: `Tag · ${t.count ?? 0} titles`, image: t.image, to: tagRoute(t.slug) })),
      ),
      ...(studios.data ?? []).map((s) => ({ key: `s:${s.slug}`, label: s.name, sub: `Studio · ${s.count ?? 0} titles`, to: studioRoute(s.slug) })),
    ];
  }, [filtersPage, tags.data, studios.data]);

  const source: SuggestSource = filtersPage ? { type: 'local', items: local } : { type: 'hanime' };

  /** On Browse the text narrows the tags and studios, kept in the address so Back and reloads keep it. */
  const filterPage = (text: string) => {
    const next = new URLSearchParams(params);
    if (text.trim()) next.set('q', text);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  const submit = (q: string) => {
    if (filtersPage) return filterPage(q);
    if (area === 'search') {
      const next = new URLSearchParams(params);
      next.set('q', q);
      next.delete('sort');
      return setParams(next);
    }
    navigate(searchRoute(q));
  };

  const placeholder = { browse: 'Search tags and studios', search: 'Search hentai', catalog: 'Search hentai' }[area];
  const initial = filtersPage || area === 'search' ? (params.get('q') ?? '') : '';

  return (
    <div className="w-full max-w-[22rem] shrink">
      <SearchBox
        key={area}
        scope={`hanime:${filtersPage ? area : 'titles'}`}
        source={source}
        placeholder={placeholder}
        initial={initial}
        onSubmit={submit}
        onTextChange={filtersPage ? filterPage : undefined}
        variant="header"
      />
    </div>
  );
}
