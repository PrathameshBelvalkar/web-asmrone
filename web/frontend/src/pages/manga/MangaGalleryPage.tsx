import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Ban, History } from 'lucide-react';
import { ApiError } from '../../api/client';
import { mangaGalleryOptions } from '../../api/queries';
import { DetailHero } from '../../components/DetailHero';
import { MangaImage } from '../../components/manga/MangaImage';
import { TagChips } from '../../components/manga/TagChips';
import { ErrorState } from '../../components/States';
import { EmptyState, Skeleton } from '../../components/ui';
import { useDetailCrumbs } from '../../lib/crumbs';
import { mangaHolder, readerRoute, resumePage } from '../../lib/manga';

const MANGA_HOME = [{ label: 'Manga & Doujinshi', to: '/manga' }];

/** A gallery: the shared detail hero (cover, titles, Read / Continue), its tags, and every page as a thumbnail. */
export function MangaGalleryPage() {
  const { id = '' } = useParams();
  const gallery = useQuery(mangaGalleryOptions(id));
  const g = gallery.data;
  useDetailCrumbs(g?.prettyTitle ?? g?.title ?? `#${id}`, MANGA_HOME);

  if (gallery.error instanceof ApiError && gallery.error.status === 451) {
    return (
      <EmptyState icon={Ban} title="Not available">
        This gallery has content Echo doesn't show.
      </EmptyState>
    );
  }
  if (gallery.error) return <ErrorState error={gallery.error} onRetry={() => void gallery.refetch()} />;
  if (!g) return <GallerySkeleton />;

  const resume = resumePage(g.id);
  const uploaded = g.uploadedAt ? new Date(g.uploadedAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null;
  const category = g.tags.find((t) => t.kind === 'category')?.name;

  return (
    <article>
      <DetailHero
        // The first page colours the header: it's the image most sure to exist.
        cover={mangaHolder(g.pages[0]?.thumb ?? g.cover)}
        art={
          <MangaImage
            src={g.cover}
            fallbacks={g.coverFallbacks}
            alt=""
            loading="eager"
            className="aspect-[1/1.41] w-full max-w-[220px] shrink-0 rounded-2xl shadow-2xl shadow-black/60 @2xl:w-56"
            imgClassName="h-full w-full object-cover"
          />
        }
        shape="portrait"
        eyebrow={category ? category[0]!.toUpperCase() + category.slice(1) : 'Gallery'}
        title={g.title}
        meta={
          <>
            {g.titleJapanese && <p className="mb-1 text-foreground/60">{g.titleJapanese}</p>}
            <span className="tnum">{g.pages.length}</span> pages
            {uploaded && <> · {uploaded}</>}
            {g.scanlator && <> · {g.scanlator}</>}
            <span className="tnum"> · #{g.id}</span>
          </>
        }
        actions={
          <>
            <Link
              to={readerRoute(g.id)}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.97]"
            >
              <BookOpen size={18} aria-hidden /> Read
            </Link>
            {resume && (
              <Link
                to={readerRoute(g.id, resume)}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-medium text-foreground/90 transition-colors hover:border-white/30 hover:bg-white/10"
              >
                <History size={18} aria-hidden /> Continue from page {resume}
              </Link>
            )}
          </>
        }
      />

      <section className="mb-12">
        <h2 className="mb-5 text-2xl font-semibold md:text-[28px]">Tags</h2>
        <TagChips tags={g.tags} />
      </section>

      <section>
        <h2 className="mb-5 text-2xl font-semibold md:text-[28px]">Pages</h2>
        <ol className="stagger grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]">
          {g.pages.map((p, i) => (
            <li key={p.n} style={{ '--i': i % 24 } as React.CSSProperties}>
              <Link to={readerRoute(g.id, p.n)} className="group block rounded-xl" aria-label={`Page ${p.n}`}>
                <MangaImage
                  src={p.thumb}
                  fallbacks={[p.url]}
                  alt=""
                  className="aspect-[1/1.41] w-full rounded-xl shadow-lg shadow-black/40 transition-[filter] group-hover:brightness-110"
                  imgClassName="h-full w-full object-cover"
                />
                <span className="mt-2 block text-center text-xs text-muted-foreground tnum">{p.n}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}

function GallerySkeleton() {
  return (
    <div className="mb-12 flex flex-col gap-6 pt-4 sm:flex-row sm:items-end sm:gap-9" aria-hidden>
      <Skeleton className="aspect-[1/1.41] w-full max-w-[220px] rounded-2xl sm:w-56" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="mt-6 h-12 w-28 rounded-full" />
      </div>
    </div>
  );
}
