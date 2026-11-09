import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ListPlus, Plus } from 'lucide-react';
import { useAddToPlaylist, usePlaylistCreate } from '../api/mutations';
import { editableOptions } from '../api/queries';
import type { Track } from '../api/types';
import { messageFor } from '../lib/errors';
import { toast } from '../lib/toast';
import { RowSkeletons } from './States';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui';
import { Input } from './ui/input';

/** Add a track to one of your playlists, or to a new one. */
export function PlaylistDialog({ track, onClose }: { track: Track; onClose: () => void }) {
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const editable = useQuery(editableOptions(track));
  const addMutation = useAddToPlaylist();
  const createMutation = usePlaylistCreate();

  const add = async (playlistId: string) => {
    const entry = editable.data?.find((e) => e.playlist.id === playlistId);
    if (!entry) return;
    setBusy(true);
    try {
      await addMutation.mutateAsync({ playlist: entry.playlist, track });
      toast(`Added to ${entry.playlist.title}`);
    } catch (e) {
      toast(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const playlist = await createMutation.mutateAsync({ title: name, description: null });
      await addMutation.mutateAsync({ playlist, track });
      toast(`Created “${playlist.title}” with this track`);
      onClose();
    } catch (e) {
      toast(messageFor(e));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="px-6 pb-4 pt-6">
          <DialogTitle>Add to playlist</DialogTitle>
          <DialogDescription className="truncate">{track.title}</DialogDescription>
        </DialogHeader>

        <div className="scroll-thin max-h-72 overflow-y-auto border-y px-2 py-2">
          {editable.isPending && <RowSkeletons count={3} />}
          {editable.error && <p className="px-4 py-3 text-sm text-destructive">{messageFor(editable.error)}</p>}
          {editable.data && editable.data.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No playlists yet. Create one below.</p>
          )}
          <ul className="space-y-0.5">
            {editable.data?.map(({ playlist, contains }) => (
              <li key={playlist.id}>
                <Button
                  variant="ghost"
                  disabled={contains || busy}
                  onClick={() => add(playlist.id)}
                  className="h-auto w-full justify-between gap-3 rounded-lg px-4 py-2.5 text-left font-normal"
                >
                  <span className="min-w-0 truncate">{playlist.title}</span>
                  {contains ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-primary"><Check size={14} aria-hidden />Added</span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"><ListPlus size={14} aria-hidden />Add</span>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2 px-6 py-4">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void create()}
            placeholder="New playlist name"
            aria-label="New playlist name"
            className="rounded-full"
          />
          <Button variant="primary" icon={Plus} onClick={create} disabled={!newName.trim() || busy}>Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
