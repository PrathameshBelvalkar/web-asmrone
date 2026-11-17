import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { javGenresOptions, javNewsOptions } from '../../api/queries';
import type { JavNewsCategory } from '../../api/types';
import { formatDate, isJavKind, listRoute, NEWS_CATEGORIES, newsRoute, searchRoute } from '../../lib/jav';
import { SearchBox, type SuggestSource } from './SearchBox';

type Area = 'news' | 'movies' | 'idols' | 'genres' | 'search';

/** Which search a JAV page's top bar offers. */
export function javSearchArea(pathname: string): Area {
  if (/^\/jav\/?$/.test(pathname) || pathname.startsWith('/jav/news/')) return 'news';
  if (pathname === '/jav/genres' || pathname.startsWith('/jav/movies/genre/')) return 'genres';
  if (pathname.startsWith('/jav/idol')) return 'idols';
  if (pathname === '/jav/search') return 'search';
  return 'movies';
}

/**
 * The top bar's search on JAV pages, with suggestions for the page you're on. News and Genres filter
 * their page as you type (`?q=`); the others suggest from the site's search and open the Search page.
 */
export function JavHeaderSearch() {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const area = javSearchArea(pathname);
  const onListPage = pathname === '/jav' || pathname === '/jav/' || pathname === '/jav/genres';

  const rawCategory = params.get('category');
  const category = NEWS_CATEGORIES.some((c) => c.value === rawCategory && c.value !== 'all')
    ? (rawCategory as JavNewsCategory)
    : null;
  // The same queries the News and Genres pages run, so their data is shared, not fetched twice.
  const news = useInfiniteQuery({ ...javNewsOptions(category), enabled: area === 'news' });
  const genres = useQuery({ ...javGenresOptions(), enabled: area === 'genres' });

  const local = useMemo(() => {
    if (area === 'news') {
      return (news.data?.pages.flatMap((p) => p.items) ?? []).map((i) => ({
        key: i.path,
        label: i.title,
        sub: formatDate(i.date),
        image: i.image,
        to: newsRoute(i.path),
      }));
    }
    if (area === 'genres') {
      const seen = new Set<string>();
      return (genres.data?.groups ?? [])
        .flatMap((g) => g.genres.map((x) => ({ ...x, group: g.name })))
        .filter((x) => !seen.has(x.slug) && !!seen.add(x.slug))
        .map((x) => ({ key: x.slug, label: x.name, sub: x.group, to: listRoute('genre', x.slug) }));
    }
    return [];
  }, [area, news.data, genres.data]);

  const rawKind = params.get('kind') ?? '';
  const kind = isJavKind(rawKind) ? rawKind : undefined;
  const searchType = params.get('type') === 'idols' ? 'idols' : 'movies';
  const source: SuggestSource =
    area === 'news' || area === 'genres'
      ? { type: 'local', items: local }
      : area === 'idols' || (area === 'search' && searchType === 'idols')
        ? { type: 'idols' }
        : { type: 'movies', kind };

  /** On News and Genres the text filters the page, kept in the address so Back and reloads keep it. */
  const filterPage = (text: string) => {
    const base = area === 'news' ? '/jav' : '/jav/genres';
    const next = new URLSearchParams(onListPage ? params : undefined);
    if (text.trim()) next.set('q', text);
    else next.delete('q');
    const qs = next.toString();
    navigate(`${base}${qs ? `?${qs}` : ''}`, { replace: onListPage });
  };

  const submit = (q: string) => {
    if (area === 'news' || area === 'genres') return filterPage(q);
    if (area === 'search') {
      const next = new URLSearchParams(params);
      next.set('q', q);
      return setParams(next);
    }
    navigate(searchRoute(q, area === 'idols' ? 'idols' : 'movies', kind));
  };

  const placeholder = {
    news: 'Search news',
    genres: 'Search genres',
    idols: 'Search idols',
    movies: kind === 'uncensored' ? 'Search uncensored movies' : 'Search movies or DVD ID',
    search: searchType === 'idols' ? 'Search idols' : 'Search movies or DVD ID',
  }[area];

  // The filter or query of the page, shown in the field; other pages start empty.
  const initial = onListPage || area === 'search' ? (params.get('q') ?? '') : '';

  return (
    <div className="w-full max-w-[22rem] shrink">
      <SearchBox
        key={area}
        scope={area === 'search' ? searchType : area}
        source={source}
        placeholder={placeholder}
        initial={initial}
        onSubmit={submit}
        onTextChange={onListPage ? filterPage : undefined}
        variant="header"
      />
    </div>
  );
}
