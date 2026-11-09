import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Heart, Link2, Play, Radio } from 'lucide-react';
import type { Album, Artist, CategoryDto, FeedEntry, ShelfDto } from '../api/types';
import { useLike } from '../api/mutations';
import { albumFeedOptions, albumOptions, albumTracksOptions, feedOptions, likeOptions, pagesOptions } from '../api/queries';
import { Cover } from '../components/Cover';
import { FeedView } from '../components/FeedView';
import { ShelfBlock } from '../components/ShelfBlock';
import { ErrorState } from '../components/States';
import { Button, Chip, IconButton, Skeleton } from '../components/ui';
import { useCrumbs } from '../lib/crumbs';
import { artistLinkFor, playFeed, shareItem, startRadio } from '../lib/actions';
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

  const like = useQuery({ ...likeOptions(source), enabled: !!album });
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
      <section className="relative mb-12 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="absolute inset-0 -z-0 opacity-30 blur-3xl" aria-hidden>
          <Cover holder={album.cover} className="h-full w-full scale-125" rounded="" />
        </div>
        <div className="relative flex flex-col gap-6 p-5 sm:flex-row sm:gap-8 sm:p-8">
          <Cover holder={album.cover} className="aspect-square w-full max-w-[260px] shrink-0 shadow-2xl shadow-black/60 sm:w-60" rounded="rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col justify-end">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Work</p>
            <h1 className="mt-2 text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {album.title || 'Untitled work'}
            </h1>
            {album.artists?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {album.artists.map((a: Artist) => (
                  <Chip key={a.id} to={artistLinkFor(a)}>{a.name}</Chip>
                ))}
              </div>
            )}
            <p className="mt-3 text-sm tnum text-muted-foreground">
              {album.trackCount ? `${album.trackCount} tracks` : ''}
              {album.trackCount && album.duration ? ' · ' : ''}
              {album.duration ? formatDuration(album.duration) : ''}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button variant="primary" icon={Play} onClick={playAll}>Play</Button>
              <Button variant="secondary" icon={Radio} onClick={() => startRadio(album)}>Radio</Button>
              <IconButton icon={Heart} label={liked ? 'Remove from favourites' : 'Add to favourites'} active={liked} size="lg" onClick={toggleFavourite} disabled={!like.data} className="border border-input" />
              <IconButton icon={Link2} label="Copy link" size="lg" onClick={() => shareItem(album)} className="border border-input" />
            </div>

            {description && (
              <div className="mt-6 max-w-2xl">
                <p className={`whitespace-pre-line text-sm leading-relaxed text-foreground/80 ${descOpen ? '' : 'line-clamp-3'}`}>{description}</p>
                <button type="button" onClick={() => setDescOpen((v) => !v)} className="mt-2 text-xs font-medium text-muted-foreground transition hover:text-primary">
                  {descOpen ? 'Show less' : 'Show more'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mb-12">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button variant={folderId ? 'secondary' : 'primary'} className="h-8 px-3 text-xs" onClick={() => setFolderId(null)}>
            Episodes
          </Button>
          {folders.map((f) => (
            <Button
              key={f.id}
              variant={folderId === f.feedId ? 'primary' : 'secondary'}
              className="h-8 px-3 text-xs"
              onClick={() => setFolderId(f.feedId ?? null)}
            >
              {f.title}
            </Button>
          ))}
        </div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">{currentTitle}</h2>

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
  return (
    <div className="mb-12 flex flex-col gap-8 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:p-8" aria-hidden>
      <Skeleton className="aspect-square w-full max-w-[260px] sm:w-60" />
      <div className="flex-1 space-y-4 pt-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="mt-6 h-10 w-48 rounded-full" />
      </div>
    </div>
  );
}
