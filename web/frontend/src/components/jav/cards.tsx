import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { CalendarClock, Film } from 'lucide-react';
import { javIdolsOptions, javMoviesOptions } from '../../api/queries';
import type { JavIdolCard, JavIdolQuery, JavMovieCard, JavMovieQuery, JavRef } from '../../api/types';
import { formatDate, idolRoute, listRoute, movieRoute } from '../../lib/jav';
import { useJavPrefs } from '../../lib/jav-prefs';
import { mangaHolder } from '../../lib/manga';
import { useHeaderWash } from '../../lib/wash';
import { GridSkeletons, IDOL_GRID, InfiniteGrid, MOVIE_GRID } from './grid';
import { JavImage } from './JavImage';

/**
 * One movie, styled like the manga cards: a cover that darkens on hover, the DVD ID, the title on
 * two lines, and the release date. Announced movies get an Upcoming badge.
 */
export function MovieCard({ card }: { card: JavMovieCard }) {
  return (
    <Link to={movieRoute(card.kind, card.slug)} title={card.title} className="group block min-w-0 rounded-xl focus-visible:outline-none">
      <div className="relative">
        <JavImage
          src={card.cover}
          className="aspect-[147/200] w-full rounded-xl shadow-lg shadow-black/40 ring-offset-background group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2"
        />
        <span
          className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute bottom-3 right-3 flex size-11 translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-md shadow-black/40 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
          aria-hidden
        >
          <Film size={18} />
        </span>
        {card.upcoming && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-white backdrop-blur">
            <CalendarClock size={11} aria-hidden /> Upcoming
          </span>
        )}
      </div>
      {card.dvdId && <p className="mt-3 truncate text-sm font-semibold tracking-wide text-foreground tnum">{card.dvdId}</p>}
      <p className={`${card.dvdId ? 'mt-0.5 text-foreground/70' : 'mt-3 font-medium text-foreground'} line-clamp-2 text-sm leading-snug`}>
        {card.title}
      </p>
      {(card.releaseDate || card.studio) && (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {card.releaseDate && <span className="tnum">{formatDate(card.releaseDate)}</span>}
          {card.releaseDate && card.studio && ' · '}
          {card.studio?.name}
        </p>
      )}
    </Link>
  );
}

/** One idol: a portrait photo, the name and age. */
export function IdolCard({ idol, round = false }: { idol: JavIdolCard; round?: boolean }) {
  return (
    <Link to={idolRoute(idol.slug)} title={idol.name} className="group block min-w-0 rounded-xl text-center focus-visible:outline-none">
      <JavImage
        src={idol.photo}
        className={`${round ? 'aspect-square rounded-full' : 'aspect-[160/200] rounded-xl'} w-full shadow-lg shadow-black/40 transition-[filter] group-hover:brightness-110 group-focus-visible:ring-2 group-focus-visible:ring-ring`}
        imgClassName="h-full w-full object-cover object-top"
      />
      <p className="mt-3 truncate text-sm font-medium text-foreground">{idol.name}</p>
      {idol.age !== null && <p className="text-xs text-muted-foreground tnum">{idol.age}</p>}
    </Link>
  );
}

/** A movie list that loads the next site page as you scroll. The page header takes its colour from the first cover. */
export function MovieGrid({ query, emptyText = 'No movies found.' }: { query: JavMovieQuery; emptyText?: string }) {
  const list = useInfiniteQuery(javMoviesOptions(query));
  // The Upcoming list is the one place announced movies are always shown.
  const hideUpcoming = useJavPrefs((s) => s.hideUpcoming) && query.by !== 'upcoming';
  const items = useMemo(() => {
    // The site's pages can overlap when new movies arrive while you scroll.
    const seen = new Set<string>();
    return (list.data?.pages.flatMap((p) => p.items) ?? []).filter((c) => {
      const key = `${c.kind}:${c.slug}`;
      return !(hideUpcoming && c.upcoming) && !seen.has(key) && !!seen.add(key);
    });
  }, [list.data, hideUpcoming]);
  useHeaderWash(mangaHolder(items[0]?.cover));
  return (
    <InfiniteGrid
      list={list}
      items={items}
      itemKey={(c) => `${c.kind}:${c.slug}`}
      render={(c) => <MovieCard card={c} />}
      className={MOVIE_GRID}
      skeleton={<GridSkeletons className={MOVIE_GRID} aspect="aspect-[147/200]" />}
      emptyText={emptyText}
    />
  );
}

/** An idol list that loads the next site page as you scroll. */
export function IdolGrid({ query, emptyText = 'No idols found.' }: { query: JavIdolQuery; emptyText?: string }) {
  const list = useInfiniteQuery(javIdolsOptions(query));
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (list.data?.pages.flatMap((p) => p.items) ?? []).filter((i) => !seen.has(i.slug) && !!seen.add(i.slug));
  }, [list.data]);
  return (
    <InfiniteGrid
      list={list}
      items={items}
      itemKey={(i) => i.slug}
      render={(i) => <IdolCard idol={i} />}
      className={IDOL_GRID}
      skeleton={<GridSkeletons className={IDOL_GRID} aspect="aspect-[160/200]" />}
      emptyText={emptyText}
    />
  );
}

const CHIP =
  'inline-flex h-8 max-w-full items-center rounded-full border border-white/10 bg-white/[0.06] px-3.5 text-sm text-foreground/90 transition-colors hover:border-white/25 hover:bg-white/[0.12]';

/** Genre, studio or director chips, each opening that name's movie list. */
export function RefChips({ refs, by }: { refs: JavRef[]; by: 'genre' | 'studio' | 'director' }) {
  return (
    <div className="flex flex-wrap gap-2">
      {refs.map((r) => (
        <Link key={r.slug} to={listRoute(by, r.slug)} className={CHIP}>
          <span className="truncate">{r.name}</span>
        </Link>
      ))}
    </div>
  );
}
