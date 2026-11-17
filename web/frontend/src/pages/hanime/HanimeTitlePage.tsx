import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Download, ExternalLink, Eye, ThumbsUp } from 'lucide-react';
import { ApiError } from '../../api/client';
import { hanimeDetailsOptions, hanimeTitleOptions } from '../../api/queries';
import type { HanimeDetails, HanimeTitle } from '../../api/types';
import { DetailHero } from '../../components/DetailHero';
import { HanimeCard, POSTER_GRID } from '../../components/hanime/cards';
import { PreviewFrames } from '../../components/hanime/PreviewFrames';
import { isRefused, Unavailable } from '../../components/jav/grid';
import { JavImage } from '../../components/jav/JavImage';
import { ErrorState } from '../../components/States';
import { Skeleton } from '../../components/ui';
import { useDetailCrumbs } from '../../lib/crumbs';
import { formatDay, HANIME_HOME, seriesRoute, studioRoute, tagLabel, tagRoute } from '../../lib/hanime';
import { formatCount, mangaHolder } from '../../lib/manga';
import { NotFoundPage } from '../NotFoundPage';

const OUTLINE =
  'inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-medium text-foreground/90 transition-colors hover:border-white/30 hover:bg-white/10';

/**
 * A title, laid out like hanime.tv's: the cover and details, then Synopsis, Alternate Names, Preview
 * (frames from the storyboard), tags, the other episodes and similar titles. The Preview, length and
 * other names come from the title's page on the site, so they arrive a moment after the rest. No player yet.
 */
export function HanimeTitlePage() {
  const { slug = '' } = useParams();
  const title = useQuery(hanimeTitleOptions(slug));
  const t = title.data;
  const details = useQuery({ ...hanimeDetailsOptions(slug), enabled: !!t });
  const d = details.data;
  useDetailCrumbs(t?.name ?? slug.replace(/-/g, ' '), [HANIME_HOME, { label: 'All titles', to: '/hanime/titles' }]);

  if (isRefused(title.error)) return <Unavailable what="This title" />;
  if (title.error instanceof ApiError && title.error.status === 404) return <NotFoundPage />;
  if (title.error) return <ErrorState error={title.error} onRetry={() => void title.refetch()} />;
  if (!t) return <TitleSkeleton />;

  return (
    <article>
      <DetailHero
        cover={mangaHolder(t.poster || t.cover)}
        art={
          <JavImage
            src={t.cover}
            fallbacks={t.poster ? [t.poster] : undefined}
            loading="eager"
            className="aspect-[2/3] w-full max-w-[220px] shrink-0 rounded-2xl shadow-2xl shadow-black/60 @2xl:w-56"
          />
        }
        eyebrow={[t.censorship === 'uncensored' ? 'Uncensored' : t.censorship === 'censored' ? 'Censored' : null, t.episode !== null ? `Episode ${t.episode}` : null]
          .filter(Boolean)
          .join(' · ') || 'Hanime'}
        title={t.name}
        meta={<Details title={t} details={d} />}
        actions={
          <>
            <CopyName name={t.name} />
            <a href={t.siteUrl} target="_blank" rel="noreferrer noopener" className={OUTLINE}>
              <ExternalLink size={16} aria-hidden /> Open on hanime.tv
            </a>
          </>
        }
      />

      {(d?.synopsis.length ? d.synopsis : t.description).length > 0 && (
        <Section title="Synopsis">
          <Description paragraphs={d?.synopsis.length ? d.synopsis : t.description} />
        </Section>
      )}
      <Section title="Alternate Names">
        <AltNames names={d ? d.altNames : t.altTitles} />
      </Section>
      <Section title="Preview">
        {details.isPending ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]" aria-hidden>
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-lg" />
            ))}
          </div>
        ) : d?.storyboard ? (
          <PreviewFrames board={d.storyboard} durationSec={d.durationSec} title={t.name} />
        ) : (
          <p className="text-sm text-muted-foreground">{details.error ? 'The preview couldn’t be loaded from hanime.tv.' : 'No preview for this title.'}</p>
        )}
      </Section>
      {t.tags.length > 0 && (
        <Section title="Tags">
          <div className="flex flex-wrap gap-2">
            {t.tags.map((tag) => (
              <Link
                key={tag.slug}
                to={tagRoute(tag.slug)}
                className="inline-flex h-8 items-center rounded-full border border-white/10 bg-white/[0.06] px-3.5 text-sm text-foreground/90 transition-colors hover:border-white/25 hover:bg-white/[0.12]"
              >
                {tagLabel(tag.name)}
              </Link>
            ))}
          </div>
        </Section>
      )}
      {t.episodes.length > 1 && t.series && (
        <Section title={`More from ${t.series.name}`} more={{ to: seriesRoute(t.series.key), label: `All ${t.episodes.length} episodes` }}>
          <div className={POSTER_GRID}>
            {t.episodes.map((card) => (
              <div key={card.id} className={card.id === t.id ? 'rounded-xl ring-2 ring-primary ring-offset-4 ring-offset-background' : ''}>
                <HanimeCard card={card} />
              </div>
            ))}
          </div>
        </Section>
      )}
      {t.similar.length > 0 && (
        <Section title="Similar titles">
          <div className={POSTER_GRID}>
            {t.similar.map((card) => (
              <HanimeCard key={card.id} card={card} />
            ))}
          </div>
        </Section>
      )}
    </article>
  );
}

function Details({ title: t, details }: { title: HanimeTitle; details: HanimeDetails | undefined }) {
  return (
    <div className="space-y-3">
      {details && details.badges.length > 0 && (
        <p className="flex flex-wrap gap-2">
          {details.badges.map((b) => (
            <span key={b} className="rounded-md border border-white/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-foreground/80">
              {b}
            </span>
          ))}
        </p>
      )}
      <dl className="flex flex-wrap gap-x-6 gap-y-1">
        <Item label="Studio">
          <Link to={studioRoute(t.studio.slug)} className="hover:text-foreground hover:underline">
            {t.studio.name}
          </Link>
        </Item>
        <Item label="Released">{formatDay(t.releasedAt)}</Item>
        <Item label="Added">{formatDay(t.uploadedAt)}</Item>
      </dl>
      <p className="flex flex-wrap gap-x-5 gap-y-1 tnum">
        <Stat icon={<Eye size={14} aria-hidden />} label="views" value={formatCount(t.views)} />
        <Stat icon={<ThumbsUp size={14} aria-hidden />} label="likes" value={formatCount(t.likes)} />
        {t.rating !== null && <span>{Math.round(t.rating * 100)}% liked</span>}
        <Stat icon={<Download size={14} aria-hidden />} label="downloads" value={formatCount(t.downloads)} />
      </p>
    </div>
  );
}

/** The title in other languages and other English names, as chips. */
function AltNames({ names }: { names: string[] }) {
  if (names.length === 0) return <p className="text-sm text-muted-foreground">None available.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {names.map((n) => (
        <span key={n} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-foreground/70">
          {n}
        </span>
      ))}
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-foreground/50">{label}</dt>
      <dd className="text-foreground/85">{children}</dd>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${value} ${label}`}>
      {icon}
      {value}
    </span>
  );
}

/** The story, cut to five lines until opened. */
function Description({ paragraphs }: { paragraphs: string[] }) {
  const [open, setOpen] = useState(false);
  const long = paragraphs.join(' ').length > 420;
  return (
    <div className="max-w-3xl">
      <div className={`space-y-3 text-[15px] leading-relaxed text-foreground/80 ${!open && long ? 'line-clamp-5' : ''}`}>
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-2 text-sm font-medium text-primary hover:underline">
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

function CopyName({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(name).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={OUTLINE}
    >
      {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {copied ? 'Copied' : 'Copy name'}
    </button>
  );
}

function Section({ title, more, children }: { title: string; more?: { to: string; label: string }; children: ReactNode }) {
  return (
    <section className="mb-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-semibold md:text-[28px]">{title}</h2>
        {more && (
          <Link to={more.to} className="text-sm text-muted-foreground hover:text-foreground">
            {more.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function TitleSkeleton() {
  return (
    <div className="mb-12 flex flex-col gap-6 pt-4 sm:flex-row sm:items-end sm:gap-9" aria-hidden>
      <Skeleton className="aspect-[2/3] w-full max-w-[220px] rounded-2xl" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
