import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Disc3, Heart, Link2, ListEnd, ListPlus, MoreHorizontal, Radio } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Track } from '../api/types';
import { useLike } from '../api/mutations';
import { likeOptions } from '../api/queries';
import { messageFor } from '../lib/errors';
import { openMedia, playTrackNext, shareItem, startRadio } from '../lib/actions';
import { isJasmr } from '../lib/media';
import { toast } from '../lib/toast';
import { PlaylistDialog } from './PlaylistDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { cn } from '@/lib/utils';

/** The "more" menu for one track. */
export function TrackMenu({ track, label, className }: { track: Track; label: string; className?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  // japaneseasmr.com tracks have no likes, radio or playlists.
  const jasmr = isJasmr(track.id);
  // The like state is only fetched when the menu opens.
  const like = useQuery({ ...likeOptions(track), enabled: open, staleTime: 0 });
  const likeMutation = useLike(track);

  const toggleFavourite = () => {
    if (!like.data) return toast('Checking favourite status…');
    likeMutation.mutate(!like.data.liked, { onError: (e) => toast(messageFor(e)) });
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          {/* A plain button: Radix needs a ref, which the shadcn Button component doesn't forward. */}
          <button
            type="button"
            aria-label={label}
            className={cn('inline-flex size-8 items-center justify-center rounded-full text-muted-foreground opacity-100 outline-none transition hover:bg-accent hover:text-accent-foreground sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100', className)}
          >
            <MoreHorizontal size={18} aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <Item icon={ListEnd} onSelect={() => playTrackNext(track)}>Play next</Item>
          {!jasmr && (
            <>
              <Item icon={Radio} onSelect={() => void startRadio(track)}>Start radio</Item>
              <Item icon={Heart} onSelect={toggleFavourite}>
                {like.data?.liked ? 'Remove from favourites' : 'Add to favourites'}
              </Item>
              <Item icon={ListPlus} onSelect={() => setPlaylistOpen(true)}>Add to playlist…</Item>
            </>
          )}
          <Item icon={Link2} onSelect={() => void shareItem(track)}>Copy link</Item>
          <Item icon={Disc3} onSelect={() => openMedia(track, navigate)}>Go to work</Item>
        </DropdownMenuContent>
      </DropdownMenu>
      {playlistOpen && <PlaylistDialog track={track} onClose={() => setPlaylistOpen(false)} />}
    </>
  );
}

function Item({ icon: Icon, onSelect, children }: { icon: LucideIcon; onSelect: () => void; children: React.ReactNode }) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="gap-3">
      <Icon size={15} aria-hidden className="shrink-0" />
      {children}
    </DropdownMenuItem>
  );
}
