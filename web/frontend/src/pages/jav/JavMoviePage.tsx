import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, Film, Image as ImageIcon } from 'lucide-react';
import { ApiError } from '../../api/client';
import { javMovieOptions } from '../../api/queries';
import type { JavMovie } from '../../api/types';
import { DetailHero } from '../../components/DetailHero';
import { IdolCard, MovieCard, RefChips } from '../../components/jav/cards';
import { IDOL_GRID, isRefused, MOVIE_GRID, Unavailable } from '../../components/jav/grid';
import { JavImage } from '../../components/jav/JavImage';
import { SampleGallery } from '../../components/jav/SampleGallery';
import { ErrorState } from '../../components/States';
import { Skeleton } from '../../components/ui';
import { useDetailCrumbs } from '../../lib/crumbs';
import { formatDate, isJavKind, JAV_HOME, listRoute } from '../../lib/jav';
import { useJavPrefs } from '../../lib/jav-prefs';
import { mangaHolder } from '../../lib/manga';
import { NotFoundPage } from '../NotFoundPage';

const SITE = 'https://www.javdatabase.com';

/** A movie: cover (or trailer), details, genres, cast, sample images and similar movies. */
export function JavMoviePage() {
  const { kind = '', slug = '' } = useParams();
  const movie = useQuery({ ...javMovieOptions(kind, slug), enabled: isJavKind(kind) });
  const m = movie.data;
  const hideUpcoming = useJavPrefs((s) => s.hideUpcoming);
  useDetailCrumbs(m?.dvdId ?? m?.title ?? slug.toUpperCase(), [JAV_HOME, { label: 'Movies', to: '/jav/movies' }]);

  if (!isJavKind(kind)) return <NotFoundPage />;
  if (isRefused(movie.error)) return <Unavailable what="This title" />;
  if (movie.error instanceof ApiError && movie.error.status === 404) return <NotFoundPage />;
  if (movie.error) return <ErrorState error={movie.error} onRetry={() => void movie.refetch()} />;
  if (!m) return <MovieSkeleton />;

  return (
    <article>
      <DetailHero
        cover={mangaHolder(m.coverFull ?? m.cover)}
        art={<CoverOrTrailer movie={m} />}
        eyebrow={m.kind === 'uncensored' ? 'Uncensored movie' : 'Movie'}
        title={m.dvdId ?? m.title}
        meta={
          <>
            {m.dvdId && <p className="mb-4 max-w-3xl text-base leading-snug text-foreground/85">{m.title}</p>}
            <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
              {m.releaseDate && (
                <Row label="Release date">
                  <span className="tnum">{formatDate(m.releaseDate)}</span>
                  {m.upcoming && <span className="ml-2 rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">Upcoming</span>}
                </Row>
              )}
              {m.runtimeMin !== null && <Row label="Runtime"><span className="tnum">{m.runtimeMin} min</span></Row>}
              {m.studio && <Row label="Studio"><Link className="hover:underline" to={listRoute('studio', m.studio.slug)}>{m.studio.name}</Link></Row>}
              {m.director && <Row label="Director"><Link className="hover:underline" to={listRoute('director', m.director.slug)}>{m.director.name}</Link></Row>}
              {m.series && <Row label="Series">{m.series.name}</Row>}
              {m.contentId && <Row label="Content ID"><span className="tnum">{m.contentId}</span></Row>}
            </dl>
          </>
        }
        actions={<Actions movie={m} />}
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

/** The landscape cover, or the trailer once asked for. The trailer loads from its host in the browser. */
function CoverOrTrailer({ movie }: { movie: JavMovie }) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const box = 'aspect-[800/538] w-full max-w-[480px] shrink-0 overflow-hidden rounded-2xl shadow-2xl shadow-black/60 @2xl:w-[440px]';
  return (
    <div className="w-full max-w-[480px] shrink-0 @2xl:w-[440px]">
      {playing && movie.trailer && !failed ? (
        <video
          className={`${box} bg-black`}
          src={movie.trailer}
          poster={movie.coverFull ?? undefined}
          controls
          playsInline
          onError={() => setFailed(true)}
        />
      ) : (
        <JavImage src={movie.coverFull ?? movie.cover} loading="eager" className={box} imgClassName="h-full w-full object-contain" />
      )}
      {movie.trailer && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setPlaying((p) => !p);
              setFailed(false);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-medium hover:border-white/30 hover:bg-white/10"
          >
            {playing ? <ImageIcon size={16} aria-hidden /> : <Film size={16} aria-hidden />}
            {playing ? 'Cover' : 'Trailer'}
          </button>
          {playing && failed && (
            <p className="text-sm text-muted-foreground">
              {/* DMM's video host answers 403 outside Japan, on javdatabase.com too. */}
              {/\.dmm\.co\.jp\//.test(movie.trailer) ? 'Trailer unavailable: DMM only serves trailers in Japan.' : 'Trailer unavailable.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Actions({ movie }: { movie: JavMovie }) {
  const [copied, setCopied] = useState(false);
  const site = `${SITE}/${movie.kind === 'uncensored' ? 'uncensored' : 'movies'}/${movie.slug}/`;
  return (
    <>
      <a
        href={site}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.97]"
      >
        <ExternalLink size={16} aria-hidden /> Open on javdatabase.com
      </a>
      {movie.dvdId && (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(movie.dvdId ?? '').then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-medium text-foreground/90 hover:border-white/30 hover:bg-white/10"
        >
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copied ? 'Copied' : 'Copy DVD ID'}
        </button>
      )}
    </>
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
