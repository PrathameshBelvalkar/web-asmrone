import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Heart, Link2, Radio } from 'lucide-react';
import type { Album, Artist, CategoryDto, FeedEntry, ShelfDto } from '../api/types';
import { useLike } from '../api/mutations';
import { albumFeedOptions, albumOptions, albumTracksOptions, feedOptions, likeOptions, pagesOptions } from '../api/queries';
import { DetailHero, HeroPlayButton } from '../components/DetailHero';
import { FeedView } from '../components/FeedView';
import { ShelfBlock } from '../components/ShelfBlock';
import { ErrorState } from '../components/States';
import { Button, IconButton, Skeleton } from '../components/ui';
import { useHeaderWash } from '../lib/wash';
import { useCrumbs } from '../lib/crumbs';
import { artistLinkFor, playFeed, shareItem, startRadio } from '../lib/actions';
import { isExternal } from '../lib/media';
import { albumStub, formatDuration } from '../lib/media';
import { messageFor } from '../lib/errors';
import { toast } from '../lib/toast';

const isShelf = (e: FeedEntry): e is ShelfDto => !('mediaItemType' in e);

/**
 * A work: hero with its actions, then the episodes. The work's folders switch the list below,
 * and the "Related" works sit at the bottom.
 */
export function WorkPage() {
  const { id = '' } = useParams();
  const stub = useMemo(() => albumStub(id), [id]);
  const [descOpen, setDescOpen] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);

  const detail = useQuery(albumOptions(stub));
  const album = detail.data as Album | undefined;
  const source = album ?? stub;
  useCrumbs([{ label: 'Home', to: '/' }, { label: album?.title?.trim() || 'Work' }]);

  // Episodes: the work's main audio folder.
  const episodes = useQuery({ ...albumTracksOptions(source), enabled: !!album });
  // Folder list and "Related" come from the work's feed page.
  const workFeed = useQuery({ ...albumFeedOptions(source), enabled: !!album });
  const workPages = useInfiniteQuery(pagesOptions(workFeed.data?.pagedId));
  const shelves = (workPages.data?.pages.flatMap((p) => p.items) ?? []).filter(isShelf);
  const folders: CategoryDto[] = shelves.flatMap((s) => (s.kind === 'category' && s.category ? [s.category] : []));
  const related = shelves.find((s) => s.kind === 'items' && s.id === 'related');

  // A selected folder's tracks.
  const folderFeed = useQuery(feedOptions(folderId ?? ''));
  const current = folderId ? folderFeed.data : episodes.data;
  const currentTitle = folderId ? folders.find((f) => f.feedId === folderId)?.title ?? 'Folder' : 'Episodes';
  const currentQuery = folderId ? folderFeed : episodes;

  // japaneseasmr.com works have no likes or radio.
  const jasmr = isExternal(source.id);
  const like = useQuery({ ...likeOptions(source), enabled: !!album && !jasmr });
  const likeMutation = useLike(source);

  if (detail.isPending) return <HeroSkeleton />;
  if (detail.error) return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  if (!album) return null;

  const playAll = async () => {
    if (current) return playFeed(current);
    toast('Episodes are still loading.');
  };

  const toggleFavourite = () => {
    if (!like.data) return;
    likeMutation.mutate(!like.data.liked, { onError: (e) => toast(messageFor(e)) });
  };

  const description = album.description ?? '';
  const liked = like.data?.liked ?? false;

  return (
    <>
      {/* 4:3 cover like the covers themselves, the whole image shown, and never stretched by a long description. */}
      <DetailHero
        cover={album.cover}
        shape="wide"
        eyebrow="Work"
        title={album.title || 'Untitled work'}
        meta={
          <>
            {album.artists?.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-x-1 text-base font-semibold text-foreground">
                {album.artists.map((a: Artist, i: number) => (
                  <span key={a.id}>
                    <Link to={artistLinkFor(a)} className="hover:underline">{a.name}</Link>
                    {i < album.artists.length - 1 && <span className="text-foreground/50">,</span>}
                  </span>
                ))}
              </div>
            )}
            <span className="tnum">
              {album.trackCount ? `${album.trackCount} tracks` : ''}
              {album.trackCount && album.duration ? ' · ' : ''}
              {album.duration ? formatDuration(album.duration) : ''}
            </span>
          </>
        }
        actions={
          <>
            <HeroPlayButton onClick={() => void playAll()} />
            {!jasmr && (
              <>
                <Button variant="secondary" icon={Radio} className="h-11 border-white/15 bg-white/[0.07] px-5 hover:bg-white/15" onClick={() => startRadio(album)}>Radio</Button>
                <IconButton icon={Heart} label={liked ? 'Remove from favourites' : 'Add to favourites'} active={liked} size="lg" onClick={toggleFavourite} disabled={!like.data} className="border border-white/15 bg-white/[0.07]" />
              </>
            )}
            <IconButton icon={Link2} label="Copy link" size="lg" onClick={() => shareItem(album)} className="border border-white/15 bg-white/[0.07]" />
          </>
        }
      >
        {description && (
          <div className="mt-6 max-w-2xl">
            <p className={`whitespace-pre-line text-sm leading-relaxed text-foreground/75 ${descOpen ? '' : 'line-clamp-3'}`}>{description}</p>
            <button type="button" onClick={() => setDescOpen((v) => !v)} className="mt-2 text-xs font-medium text-foreground/70 transition-colors hover:text-foreground">
              {descOpen ? 'Show less' : 'Show more'}
            </button>
          </div>
        )}
      </DetailHero>

      <section className="mb-12">
        {folders.length > 0 && (
        <div className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1">
          {[{ id: null as string | null, title: 'Episodes' }, ...folders.map((f) => ({ id: f.feedId ?? null, title: f.title }))].map((f, i) => {
            const active = i === 0 ? !folderId : folderId === f.id;
            return (
              <button
                key={`${f.id}-${i}`}
                type="button"
                onClick={() => setFolderId(f.id)}
                className={`h-9 shrink-0 rounded-lg border px-4 text-sm font-medium transition-colors ${active ? 'border-transparent bg-white text-black' : 'border-white/10 bg-white/[0.08] text-foreground hover:bg-white/[0.14]'}`}
              >
                {f.title}
              </button>
            );
          })}
        </div>
        )}
        <h2 className="mb-4 text-2xl font-semibold">{currentTitle}</h2>

        {currentQuery.isPending && <RowSkeletons />}
        {currentQuery.error && <ErrorState error={currentQuery.error} onRetry={() => void currentQuery.refetch()} />}
        {current && (
          <FeedView feed={current} playable onExpired={() => void currentQuery.refetch()} emptyText="No episodes in this folder." />
        )}
        {workFeed.error && !folderId && <ErrorState error={workFeed.error} onRetry={() => void workFeed.refetch()} />}
      </section>

      {related && <ShelfBlock shelf={related} />}
    </>
  );
}

function RowSkeletons() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="h-11 w-11 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HeroSkeleton() {
  // The stub's cover isn't known yet: keep the previous wash from flashing over the skeleton.
  useHeaderWash(null);
  return (
    <div className="@container mb-12 pt-2 sm:pt-4" aria-hidden>
      <div className="flex flex-col gap-6 @2xl:flex-row @2xl:items-end @2xl:gap-9">
        <Skeleton className="aspect-[4/3] w-full max-w-[380px] shrink-0 self-start rounded-2xl @2xl:w-80" />
        <div className="flex-1 space-y-4 pt-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="mt-6 size-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}
