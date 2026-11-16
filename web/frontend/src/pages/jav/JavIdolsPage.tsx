import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '../../api/client';
import { javIdolOptions } from '../../api/queries';
import type { JavIdol, JavIdolFilters, JavIdolSort } from '../../api/types';
import { DetailHero } from '../../components/DetailHero';
import { IdolCard, IdolGrid, MovieGrid } from '../../components/jav/cards';
import { FacetSheet } from '../../components/jav/FacetSheet';
import { SearchBox } from '../../components/jav/SearchBox';
import { IDOL_GRID, isRefused, Unavailable } from '../../components/jav/grid';
import { JavImage } from '../../components/jav/JavImage';
import { Segmented } from '../../components/manga/Segmented';
import { ErrorState } from '../../components/States';
import { PageHeader, Skeleton } from '../../components/ui';
import { useCrumbs, useDetailCrumbs } from '../../lib/crumbs';
import { filtersFromParams, formatDate, IDOL_FILTERS, JAV_HOME, searchRoute } from '../../lib/jav';
import { mangaHolder } from '../../lib/manga';

const SORTS: { value: JavIdolSort; label: string }[] = [
  { value: 'debut', label: 'Newest debut' },
  { value: 'most_favorited', label: 'Most favourited' },
  { value: 'top_rated', label: 'Top rated' },
  { value: 'newest', label: 'Recently added' },
  { value: 'name', label: 'Name' },
];

/** Every idol, sorted and filtered. Sort and filters live in the address, so Back and links keep them. */
export function JavIdolsPage() {
  useCrumbs([{ label: 'JAV', to: '/jav' }, { label: 'Idols' }]);
  const [params, setParams] = useSearchParams();
  const raw = params.get('sort');
  const sort: JavIdolSort = SORTS.some((s) => s.value === raw) ? (raw as JavIdolSort) : 'debut';
  const filters = filtersFromParams(params);
  const navigate = useNavigate();

  const apply = (nextSort: JavIdolSort, nextFilters: JavIdolFilters) => {
    const next = new URLSearchParams();
    if (nextSort !== 'debut') next.set('sort', nextSort);
    for (const f of IDOL_FILTERS) {
      const values = nextFilters[f.key];
      if (values && values.length > 0) next.set(f.key, values.join(','));
    }
    if (nextFilters.debutYear) next.set('debutYear', nextFilters.debutYear);
    setParams(next, { replace: true });
  };
  const query = { by: 'all' as const, sort, filters };

  return (
    <>
      <PageHeader title="Idols" />
      <div className="mb-5 max-w-xl">
        <SearchBox
          scope="idols"
          source={{ type: 'idols' }}
          placeholder="Search idols by name"
          onSubmit={(q) => navigate(searchRoute(q, 'idols'))}
          size="md"
        />
      </div>
      <div className="mb-4">
        <Segmented<JavIdolSort> label="Sort" value={sort} onChange={(v) => apply(v, filters)} options={SORTS} />
      </div>
      <div className="mb-8">
        <FacetSheet filters={filters} onChange={(next) => apply(sort, next)} />
      </div>
      <IdolGrid key={JSON.stringify(query)} query={query} emptyText="No idols match these filters." />
    </>
  );
}

/** An idol: photo, names and profile, a short biography, their movies, and related idols. */
export function JavIdolPage() {
  const { slug = '' } = useParams();
  const idol = useQuery(javIdolOptions(slug));
  const i = idol.data;
  useDetailCrumbs(i?.name ?? slug.replace(/-/g, ' '), [JAV_HOME, { label: 'Idols', to: '/jav/idols' }]);

  if (isRefused(idol.error)) return <Unavailable what="This idol" />;
  if (idol.error instanceof ApiError && idol.error.status === 404) {
    return <ErrorState error={new Error('This idol was not found.')} />;
  }
  if (idol.error) return <ErrorState error={idol.error} onRetry={() => void idol.refetch()} />;
  if (!i) return <IdolSkeleton />;

  const counts = [
    i.censoredCount ? `${i.censoredCount} censored` : null,
    i.uncensoredCount ? `${i.uncensoredCount} uncensored` : null,
  ].filter(Boolean);

  return (
    <article>
      <DetailHero
        cover={mangaHolder(i.photoFull ?? i.photo)}
        art={
          <JavImage
            src={i.photoFull ?? i.photo}
            loading="eager"
            className="size-40 shrink-0 rounded-full shadow-2xl shadow-black/60 @2xl:size-52"
            imgClassName="h-full w-full object-cover object-top"
          />
        }
        shape="round"
        eyebrow="Idol"
        title={i.name}
        meta={
          <>
            {i.nameJapanese && <p className="mb-1 text-foreground/80">{i.nameJapanese}</p>}
            {i.altNames.length > 0 && <p className="mb-1">Also known as {i.altNames.join(', ')}</p>}
            {counts.length > 0 && <p>{counts.join(' · ')} movies</p>}
          </>
        }
      />

      <Profile idol={i} />
      {i.bio && <Bio text={i.bio} />}

      <section className="mb-12">
        <h2 className="mb-5 text-2xl font-semibold md:text-[28px]">Movies</h2>
        <MovieGrid key={slug} query={{ by: 'idol', slug }} />
      </section>

      {i.related.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-5 text-2xl font-semibold md:text-[28px]">Related idols</h2>
          <div className={IDOL_GRID}>
            {i.related.map((r) => (
              <IdolCard key={r.slug} idol={r} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function Profile({ idol }: { idol: JavIdol }) {
  const rows: [string, ReactNode][] = [];
  if (idol.age !== null) rows.push(['Age', idol.age]);
  if (idol.dob) rows.push(['Born', idol.dob.includes('?') ? idol.dob.slice(0, 4) : formatDate(idol.dob)]);
  if (idol.debut) rows.push(['Debut', `${formatDate(idol.debut)}${idol.debutAge !== null ? ` (age ${idol.debutAge})` : ''}`]);
  if (idol.heightCm !== null) rows.push(['Height', `${idol.heightCm} cm`]);
  if (idol.measurements) rows.push(['Measurements', idol.measurements]);
  if (idol.cup) rows.push(['Cup', idol.cup]);
  if (idol.blood) rows.push(['Blood type', idol.blood]);
  if (idol.birthplace) rows.push(['Birthplace', idol.birthplace]);
  if (idol.sign) rows.push(['Sign', idol.sign]);
  if (idol.hairLength.length > 0) rows.push(['Hair length', idol.hairLength.join(', ')]);
  if (idol.hairColor.length > 0) rows.push(['Hair colour', idol.hairColor.join(', ')]);
  if (idol.tags.length > 0) rows.push(['Tags', idol.tags.join(', ')]);
  if (rows.length === 0) return null;
  return (
    <section className="mb-10">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 truncate text-sm text-foreground/90 tnum">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Bio({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mb-12 max-w-3xl">
      <h2 className="mb-3 text-2xl font-semibold md:text-[28px]">Biography</h2>
      <p className={`text-sm leading-relaxed text-foreground/80 ${open ? '' : 'line-clamp-4'}`}>{text}</p>
      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-2 text-sm text-primary hover:underline">
        {open ? 'Show less' : 'Show more'}
      </button>
    </section>
  );
}

function IdolSkeleton() {
  return (
    <div className="mb-12 flex flex-col items-center gap-6 pt-4 sm:flex-row sm:items-end sm:gap-9" aria-hidden>
      <Skeleton className="size-40 rounded-full sm:size-52" />
      <div className="w-full flex-1 space-y-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-2/5" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  );
}
