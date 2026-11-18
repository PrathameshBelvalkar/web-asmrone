import { useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { mangaListOptions } from '../../api/queries';
import type { MangaListQuery, MangaSort, MangaTagKind } from '../../api/types';
import { DetailHero } from '../../components/DetailHero';
import { MangaGrid } from '../../components/manga/MangaGrid';
import { MangaImage } from '../../components/manga/MangaImage';
import { Segmented } from '../../components/manga/Segmented';
import { EmptyState } from '../../components/ui';
import { Ban } from 'lucide-react';
import { useDetailCrumbs } from '../../lib/crumbs';
import { formatCount, isMangaTagKind, KIND_LABEL, MANGA_CATEGORIES, MANGA_LANGUAGES, mangaHolder } from '../../lib/manga';
import { NotFoundPage } from '../NotFoundPage';

const SORTS: { value: MangaSort; label: string }[] = [
  { value: 'new', label: 'Newest' },
  { value: '24h', label: 'Popular today' },
  { value: '7d', label: 'This week' },
  { value: 'popular', label: 'All time' },
];

/** Where each kind's A–Z list lives, for the breadcrumb. Languages and categories have none. */
const INDEX_ROUTE: Partial<Record<MangaTagKind, string>> = {
  artist: '/manga/artists',
  tag: '/manga/tags',
  character: '/manga/tags?kind=character',
  parody: '/manga/tags?kind=parody',
  group: '/manga/tags?kind=group',
};

/**
 * One artist, tag, character, parody, group, language or category: a header with its name and
 * gallery count (artists get a round picture from their newest cover), then its galleries.
 */
export function MangaListPage() {
  const { kind = '', slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const raw = params.get('sort');
  const sort: MangaSort = SORTS.some((s) => s.value === raw) ? (raw as MangaSort) : 'new';
  const valid = isMangaTagKind(kind) && slug.length > 0;
  const query: MangaListQuery | null = valid ? { by: kind, slug, sort } : null;
  // Same query and cache as the grid below; read here for the name, count and picture.
  const list = useInfiniteQuery({ ...mangaListOptions(query ?? { by: 'browse', sort: 'new' }), enabled: !!query });
  const first = list.data?.pages[0];
  const fixedName = [...MANGA_LANGUAGES, ...MANGA_CATEGORIES].find((x) => x.slug === slug)?.label;
  const rawName = first?.tag?.name ?? safeDecode(slug).replace(/-/g, ' ');
  const name = fixedName ?? (kind === 'artist' ? titleCase(rawName) : rawName);
  const label = valid ? KIND_LABEL[kind] : null;
  const indexRoute = valid ? INDEX_ROUTE[kind] : undefined;
  useDetailCrumbs(name, [
    { label: 'Manga & Doujinshi', to: '/manga' },
    ...(label && indexRoute ? [{ label: label.many, to: indexRoute }] : []),
  ]);
  if (!valid || !label || !query) return <NotFoundPage />;

  if (list.error instanceof ApiError && list.error.status === 451) {
    return (
      <EmptyState icon={Ban} title="Not available">
        This list has content NekoHub doesn't show.
      </EmptyState>
    );
  }

  const count = first?.tag?.count ?? null;
  const newest = kind === 'artist' ? first?.items[0] : undefined;
  return (
    <>
      <DetailHero
        cover={mangaHolder(newest?.cover)}
        art={
          newest && (
            <MangaImage
              src={newest.cover}
              fallbacks={newest.coverFallbacks}
              alt=""
              loading="eager"
              className="size-40 shrink-0 rounded-full shadow-2xl shadow-black/60 @2xl:size-52"
              imgClassName="h-full w-full object-cover"
            />
          )
        }
        shape={kind === 'artist' ? 'round' : 'none'}
        eyebrow={label.one}
        title={name}
        meta={count !== null ? `${formatCount(count)} ${count === 1 ? 'gallery' : 'galleries'}` : undefined}
      />
      <div className="mb-8">
        <Segmented<MangaSort>
          label="Sort"
          value={sort}
          onChange={(v) => setParams(v === 'new' ? {} : { sort: v }, { replace: true })}
          options={SORTS}
        />
      </div>
      <MangaGrid key={`${kind}:${slug}:${sort}`} query={query} />
    </>
  );
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The site lowercases names; artists read better capitalised ("nemui nezu" → "Nemui Nezu"). */
function titleCase(name: string): string {
  return name.replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());
}
