import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange, Dices, Film, TrendingUp, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../../api/client';
import { hanimeSeasonsOptions, hanimeStudiosOptions, hanimeTagsOptions } from '../../api/queries';
import type { HanimeTagRef } from '../../api/types';
import { HanimeCard, POSTER_GRID } from '../../components/hanime/cards';
import { Segmented } from '../../components/manga/Segmented';
import { ErrorState, Spinner } from '../../components/States';
import { PageHeader, Skeleton } from '../../components/ui';
import { useCrumbs } from '../../lib/crumbs';
import { browseRoute, HANIME_HOME, seasonsRoute, studioRoute, tagLabel, tagRoute, titleRoute } from '../../lib/hanime';
import { formatCount } from '../../lib/manga';

const ART = 'https://hanime-cdn.com/images';

/** The four big cards at the top of Browse, with hanime's own artwork. */
const FEATURES: { title: string; text: string; to: string; image: string; icon: LucideIcon }[] = [
  { title: 'Trending', text: 'The most watched right now', to: browseRoute({ sort: 'trending' }), image: `${ART}/bg-trending.min.jpg`, icon: TrendingUp },
  { title: 'Seasons', text: 'Releases season by season', to: seasonsRoute(), image: `${ART}/bg-seasons.min.jpg`, icon: CalendarRange },
  { title: 'Random', text: 'Feeling lucky?', to: '/hanime/random', image: `${ART}/bg-random.min.jpg`, icon: Dices },
  { title: 'All titles', text: 'Every title, with filters', to: browseRoute(), image: `${ART}/bg-images.min.jpg`, icon: Film },
];

/**
 * Browse, laid out like hanime.tv's: four big cards (Trending, Seasons, Random, All titles), a card
 * per tag with its picture, description and count, and the studios. The top bar narrows the tags
 * and studios as you type (`?q=`).
 */
export function HanimeGalleryPage() {
  useCrumbs([HANIME_HOME, { label: 'Browse' }]);
  const { hash } = useLocation();
  const [params, setParams] = useSearchParams();
  const tags = useQuery(hanimeTagsOptions());
  const studios = useQuery(hanimeStudiosOptions());
  const filter = (params.get('q') ?? '').trim();
  const needle = filter.toLowerCase();
  const [group, setGroup] = useState('All');
  const studioSort = params.get('studios') === 'name' ? 'name' : 'count';

  // Old /hanime/tags and /hanime/studios links land on their section.
  useEffect(() => {
    if (!hash || !tags.isSuccess || !studios.isSuccess) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash, tags.isSuccess, studios.isSuccess]);

  const groups = tags.data ?? [];
  const allTags = groups
    .filter((g) => group === 'All' || g.group === group)
    .flatMap((g) => g.tags)
    .filter((t) => !needle || t.name.includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name));
  const studioList = (studios.data ?? [])
    .filter((s) => !needle || s.name.toLowerCase().includes(needle))
    .sort((a, b) => (studioSort === 'name' ? a.name.localeCompare(b.name) : (b.count ?? 0) - (a.count ?? 0)));
  const setStudioSort = (v: 'count' | 'name') => {
    const next = new URLSearchParams(params);
    if (v === 'name') next.set('studios', 'name');
    else next.delete('studios');
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader title="Browse" meta={needle ? `Tags and studios matching “${filter}”` : undefined} />

      {!needle && (
        <div className="mb-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Link
              key={f.title}
              to={f.to}
              className="group relative flex h-44 flex-col justify-end overflow-hidden rounded-2xl bg-muted p-5 shadow-lg shadow-black/40 sm:h-60 lg:h-80"
            >
              <img src={f.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" aria-hidden />
              <span className="relative">
                <f.icon size={22} className="mb-2 text-primary" aria-hidden />
                <span className="block text-xl font-semibold text-white sm:text-2xl">{f.title}</span>
                <span className="mt-1 block text-sm text-white/75">{f.text}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <section id="tags" className="mb-14 scroll-mt-24">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold md:text-[28px]">Categories &amp; tags</h2>
        </div>
        {groups.length > 0 && (
          <div className="mb-6">
            <Segmented<string>
              label="Tag group"
              value={group}
              onChange={setGroup}
              options={['All', ...groups.map((g) => g.group)].map((g) => ({ value: g, label: g }))}
            />
          </div>
        )}
        {tags.error && <ErrorState error={tags.error} onRetry={() => void tags.refetch()} />}
        {tags.isPending && <TileSkeletons />}
        {tags.isSuccess && allTags.length === 0 && <p className="text-sm text-muted-foreground">No tag matches “{filter}”.</p>}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]">
          {allTags.map((t) => (
            <TagTile key={t.slug} tag={t} />
          ))}
        </div>
      </section>

      <section id="studios" className="scroll-mt-24">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold md:text-[28px]">Studios &amp; brands</h2>
          <Segmented<'count' | 'name'>
            label="Sort studios"
            value={studioSort}
            onChange={setStudioSort}
            options={[
              { value: 'count', label: 'Uploads' },
              { value: 'name', label: 'A–Z' },
            ]}
          />
        </div>
        {studios.error && <ErrorState error={studios.error} onRetry={() => void studios.refetch()} />}
        {studios.isSuccess && studioList.length === 0 && <p className="text-sm text-muted-foreground">No studio matches “{filter}”.</p>}
        <div className="flex flex-wrap gap-2">
          {studioList.map((s) => (
            <Link
              key={s.slug}
              to={studioRoute(s.slug)}
              className="group inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-white/[0.08]"
            >
              <span className="font-medium text-foreground/85 group-hover:text-primary">{s.name}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-primary tnum">{s.count}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

/** A tall tag card: the site's picture, the name, its one-line description and how many titles. */
function TagTile({ tag }: { tag: HanimeTagRef }) {
  return (
    <Link
      to={tagRoute(tag.slug)}
      className="group relative flex aspect-[2/3] flex-col justify-end overflow-hidden rounded-2xl bg-muted shadow-lg shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {tag.image && (
        <img src={tag.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" aria-hidden />
      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-xs font-semibold text-white backdrop-blur tnum">
        <Video size={12} aria-hidden /> {formatCount(tag.count ?? 0)}
      </span>
      <span className="relative p-4">
        <span className="block text-base font-bold uppercase tracking-wide text-white transition-colors group-hover:text-primary">{tagLabel(tag.name)}</span>
        {tag.description && <span className="mt-1 line-clamp-3 block text-xs leading-snug text-white/75">{tag.description}</span>}
      </span>
    </Link>
  );
}

function TileSkeletons() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]" aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[2/3] w-full rounded-2xl" />
      ))}
    </div>
  );
}

/** One year's releases, a row per season, with every year to pick from. */
export function HanimeSeasonsPage() {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get('year'));
  const year = Number.isInteger(raw) && raw > 1900 ? raw : null;
  const seasons = useQuery(hanimeSeasonsOptions(year));
  const shown = seasons.data?.year ?? year;
  useCrumbs([HANIME_HOME, { label: 'Browse', to: '/hanime/browse' }, { label: shown ? `Seasons · ${shown}` : 'Seasons' }]);

  return (
    <>
      <PageHeader title="Seasons" meta="Releases season by season. Pick a year." />
      {seasons.data && (
        <div className="mb-8">
          <Segmented<string>
            label="Year"
            value={String(seasons.data.year)}
            onChange={(v) => setParams({ year: v }, { replace: true })}
            options={seasons.data.years.map((y) => ({ value: String(y), label: String(y) }))}
          />
        </div>
      )}
      {seasons.error && <ErrorState error={seasons.error} onRetry={() => void seasons.refetch()} />}
      {seasons.isPending && <Spinner />}
      {seasons.data?.seasons.map((s) => (
        <section key={s.season} className="mb-12">
          <h2 className="mb-5 text-2xl font-semibold md:text-[28px]">
            {s.season} {seasons.data.year}
            <span className="ml-3 text-base font-normal text-muted-foreground tnum">{s.items.length}</span>
          </h2>
          <div className={POSTER_GRID}>
            {s.items.map((card) => (
              <HanimeCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/** Opens a random title, replacing this page in the history so Back skips it. */
export function HanimeRandomPage() {
  useCrumbs([HANIME_HOME, { label: 'Random' }]);
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    api.hanime
      .random()
      .then((card) => live && navigate(titleRoute(card.slug), { replace: true }))
      .catch((e: unknown) => live && setError(e));
    return () => {
      live = false;
    };
  }, [navigate, attempt]);
  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          setError(null);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  return <Spinner label="Picking a title" />;
}
