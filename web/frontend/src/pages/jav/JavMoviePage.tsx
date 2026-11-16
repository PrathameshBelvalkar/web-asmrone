import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, Film, Play, RotateCcw, X } from 'lucide-react';
import { ApiError } from '../../api/client';
import { javMovieOptions } from '../../api/queries';
import type { JavMovie } from '../../api/types';
import { DetailHero } from '../../components/DetailHero';
import { IdolCard, MovieCard, RefChips } from '../../components/jav/cards';
import { IDOL_GRID, isRefused, MOVIE_GRID, Unavailable } from '../../components/jav/grid';
import { JavImage } from '../../components/jav/JavImage';
import { JavTheater, type TheaterSource } from '../../components/jav/JavTheater';
import { SampleGallery } from '../../components/jav/SampleGallery';
import { ErrorState } from '../../components/States';
import { Skeleton } from '../../components/ui';
import { useDetailCrumbs } from '../../lib/crumbs';
import { resumeAt, useWatchEntry, type WatchedMovie } from '../../lib/history';
import { clockTime, formatDate, isJavKind, JAV_HOME, listRoute } from '../../lib/jav';
import { useJavPrefs } from '../../lib/jav-prefs';
import { mangaHolder } from '../../lib/manga';
import { NotFoundPage } from '../NotFoundPage';

const SITE = 'https://www.javdatabase.com';
const PRIMARY =
  'inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.97]';
const OUTLINE =
  'inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-medium text-foreground/90 transition-colors hover:border-white/30 hover:bg-white/10';

/**
 * A movie: the theater player when something is playing, then the cover, details, genres, cast,
 * sample images and similar movies. `?play=movie` or `?play=trailer` opens the player, so Back
 * closes it and the Library can link straight to it; `&from=start` ignores the saved place.
 */
export function JavMoviePage() {
  const { kind = '', slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const movie = useQuery({ ...javMovieOptions(kind, slug), enabled: isJavKind(kind) });
  const m = movie.data;
  const hideUpcoming = useJavPrefs((s) => s.hideUpcoming);
  const watched = useWatchEntry(kind, slug);
  useDetailCrumbs(m?.dvdId ?? m?.title ?? slug.toUpperCase(), [JAV_HOME, { label: 'Movies', to: '/jav/movies' }]);

  if (!isJavKind(kind)) return <NotFoundPage />;
  if (isRefused(movie.error)) return <Unavailable what="This title" />;
  if (movie.error instanceof ApiError && movie.error.status === 404) return <NotFoundPage />;
  if (movie.error) return <ErrorState error={movie.error} onRetry={() => void movie.refetch()} />;
  if (!m) return <MovieSkeleton />;

  const canWatch = m.dvdId !== null && !m.upcoming;
  const play = params.get('play');
  const source: TheaterSource | null =
    play === 'movie' && canWatch ? { type: 'movie' } : play === 'trailer' && m.trailer ? { type: 'trailer', url: m.trailer } : null;
  const fromStart = params.get('from') === 'start';
  const resume = canWatch ? resumeAt(watched) : null;
  const open = (what: 'movie' | 'trailer', start = false) => setParams(start ? { play: what, from: 'start' } : { play: what });
  const close = () => setParams({}, { replace: true });
  const info: WatchedMovie = { kind: m.kind, slug: m.slug, dvdId: m.dvdId, title: m.title, cover: m.coverFull ?? m.cover };

  return (
    <article>
      {source && (
        <Theater
          key={`${source.type}:${fromStart}`}
          movie={info}
          source={source}
          poster={m.coverFull ?? undefined}
          fromStart={fromStart}
          onClose={close}
        />
      )}
      <DetailHero
        cover={mangaHolder(m.coverFull ?? m.cover)}
        art={<HeroCover movie={m} canWatch={canWatch} progress={watched && canWatch ? watched : null} onPlay={() => open('movie')} />}
        eyebrow={m.kind === 'uncensored' ? 'Uncensored movie' : 'Movie'}
        title={m.dvdId ?? m.title}
        meta={<Details movie={m} />}
        actions={
          <>
            {canWatch && (
              <button type="button" onClick={() => open('movie')} className={PRIMARY}>
                <Play size={17} fill="currentColor" aria-hidden />
                {resume !== null ? `Resume ${clockTime(resume)}` : 'Watch'}
              </button>
            )}
            {resume !== null && (
              <button type="button" onClick={() => open('movie', true)} className={OUTLINE}>
                <RotateCcw size={16} aria-hidden /> Start over
              </button>
            )}
            {m.trailer && (
              <button type="button" onClick={() => open('trailer')} className={canWatch ? OUTLINE : PRIMARY}>
                <Film size={16} aria-hidden /> Trailer
              </button>
            )}
            <CopyId movie={m} />
            <a
              href={`${SITE}/${m.kind === 'uncensored' ? 'uncensored' : 'movies'}/${m.slug}/`}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Open on javdatabase.com"
              title="Open on javdatabase.com"
              className="inline-flex size-11 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-white/10 hover:text-foreground"
            >
              <ExternalLink size={18} aria-hidden />
            </a>
          </>
        }
      />

      {m.genres.length > 0 && (
        <Section title="Genres">
          <RefChips refs={m.genres} by="genre" />
        </Section>
      )}
      {m.idols.length > 0 && (
        <Section title="Cast">
          <div className={IDOL_GRID}>
            {m.idols.map((idol) => (
              <IdolCard key={idol.slug} idol={idol} />
            ))}
          </div>
        </Section>
      )}
      {m.samples.length > 0 && (
        <Section title="Images">
          <SampleGallery samples={m.samples} title={m.dvdId ?? m.title} />
        </Section>
      )}
      {similar(m, hideUpcoming).length > 0 && (
        <Section title="Similar movies">
          <div className={MOVIE_GRID}>
            {similar(m, hideUpcoming).map((card) => (
              <MovieCard key={`${card.kind}:${card.slug}`} card={card} />
            ))}
          </div>
        </Section>
      )}
    </article>
  );
}

/** The player across the top of the page, with what's playing and a way to close it. */
function Theater({
  movie, source, poster, fromStart, onClose,
}: { movie: WatchedMovie; source: TheaterSource; poster?: string; fromStart: boolean; onClose: () => void }) {
  const top = useRef<HTMLElement>(null);
  useEffect(() => {
    top.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, []);
  return (
    <section ref={top} aria-label="Player" className="mb-10 scroll-mt-20 pt-2 sm:pt-4" style={{ animation: 'rise 400ms cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <div className="mx-auto max-w-[min(100%,calc(78vh*16/9))]">
        <JavTheater movie={movie} source={source} poster={poster} fromStart={fromStart} />
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="min-w-0 truncate text-sm text-foreground/70">
            <span className="font-semibold text-foreground tnum">{movie.dvdId ?? movie.title}</span>
            {source.type === 'trailer' ? ' · Trailer' : movie.dvdId ? ` · ${movie.title}` : ''}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-foreground/70 hover:bg-white/10 hover:text-foreground"
          >
            <X size={16} aria-hidden /> Close
          </button>
        </div>
      </div>
    </section>
  );
}

/** The landscape cover. When the movie can be watched it's a play button, with how far you got. */
function HeroCover({
  movie, canWatch, progress, onPlay,
}: { movie: JavMovie; canWatch: boolean; progress: { position: number; duration: number } | null; onPlay: () => void }) {
  const box = 'relative block aspect-[800/538] w-full max-w-[520px] shrink-0 overflow-hidden rounded-2xl shadow-2xl shadow-black/60 @2xl:w-[460px]';
  const image = <JavImage src={movie.coverFull ?? movie.cover} loading="eager" className="h-full w-full bg-black/30" imgClassName="h-full w-full object-contain" />;
  if (!canWatch) return <div className={box}>{image}</div>;
  const pct = progress && progress.duration > 0 ? Math.min(100, (progress.position / progress.duration) * 100) : 0;
  return (
    <button type="button" onClick={onPlay} aria-label={`Watch ${movie.dvdId ?? movie.title}`} className={`${box} group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
      {image}
      <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0 transition-colors duration-200 group-hover:bg-black/25" aria-hidden />
      <span
        className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 scale-90 items-center justify-center rounded-full bg-primary/95 text-primary-foreground opacity-0 shadow-xl shadow-black/50 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"
        aria-hidden
      >
        <Play size={26} fill="currentColor" className="ml-1" />
      </span>
      {pct > 0 && (
        <span className="absolute inset-x-0 bottom-0 z-[1] h-1 bg-white/25" aria-hidden>
          <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
        </span>
      )}
    </button>
  );
}

function Details({ movie: m }: { movie: JavMovie }) {
  const facts = [
    m.releaseDate && (
      <span key="date" className="tnum">
        {formatDate(m.releaseDate)}
        {m.upcoming && <span className="ml-2 rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">Upcoming</span>}
      </span>
    ),
    m.runtimeMin !== null && <span key="run" className="tnum">{m.runtimeMin} min</span>,
    m.studio && (
      <Link key="studio" className="hover:text-foreground hover:underline" to={listRoute('studio', m.studio.slug)}>
        {m.studio.name}
      </Link>
    ),
  ].filter(Boolean);
  return (
    <>
      {m.dvdId && <p className="mb-4 line-clamp-3 max-w-3xl text-base leading-snug text-foreground/85">{m.title}</p>}
      {facts.length > 0 && (
        <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-foreground/75">
          {facts.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-2">
              {i > 0 && <span className="text-foreground/30" aria-hidden>•</span>}
              {f}
            </span>
          ))}
        </p>
      )}
      {(m.director || m.series || m.contentId) && (
        <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
          {m.director && <Row label="Director"><Link className="hover:underline" to={listRoute('director', m.director.slug)}>{m.director.name}</Link></Row>}
          {m.series && <Row label="Series">{m.series.name}</Row>}
          {m.contentId && <Row label="Content ID"><span className="tnum">{m.contentId}</span></Row>}
        </dl>
      )}
    </>
  );
}

function CopyId({ movie }: { movie: JavMovie }) {
  const [copied, setCopied] = useState(false);
  if (!movie.dvdId) return null;
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(movie.dvdId ?? '').then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={OUTLINE}
    >
      {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {copied ? 'Copied' : 'Copy DVD ID'}
    </button>
  );
}

const similar = (m: JavMovie, hideUpcoming: boolean) => (hideUpcoming ? m.similar.filter((c) => !c.upcoming) : m.similar);

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-foreground/55">{label}</dt>
      <dd className="min-w-0 text-foreground/90">{children}</dd>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-5 text-2xl font-semibold md:text-[28px]">{title}</h2>
      {children}
    </section>
  );
}

function MovieSkeleton() {
  return (
    <div className="mb-12 flex flex-col gap-6 pt-4 sm:flex-row sm:items-end sm:gap-9" aria-hidden>
      <Skeleton className="aspect-[800/538] w-full max-w-[440px] rounded-2xl" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-2/5" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}
