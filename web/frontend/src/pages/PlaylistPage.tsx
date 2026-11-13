import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ListMusic, Lock, Pencil, Trash2, Globe } from 'lucide-react';
import { usePlaylistDelete, usePlaylistEdit } from '../api/mutations';
import { playlistTracksOptions } from '../api/queries';
import { queryClient } from '../lib/queryClient';
import { playFeed } from '../lib/actions';
import type { Playlist } from '../api/types';
import { DetailHero, HeroPlayButton } from '../components/DetailHero';
import { FeedView } from '../components/FeedView';
import { CardSkeletons, ErrorState } from '../components/States';
import { Button } from '../components/ui';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { messageFor } from '../lib/errors';
import { playlistStub, recall } from '../lib/media';
import { toast } from '../lib/toast';
import { useCrumbs } from '../lib/crumbs';

export function PlaylistPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const playlist = recall<Playlist>('Playlist', id) ?? playlistStub(id);
  useCrumbs([{ label: 'Home', to: '/' }, { label: 'Library', to: '/library' }, { label: playlist.title }]);
  const [editing, setEditing] = useState(false);
  const feed = useQuery(playlistTracksOptions(playlist));

  const playAll = async () => {
    try {
      await playFeed(feed.data ?? (await queryClient.fetchQuery(playlistTracksOptions(playlist))));
    } catch (e) {
      toast(messageFor(e));
    }
  };

  return (
    <>
      <DetailHero
        cover={playlist.cover}
        eyebrow="Playlist"
        title={playlist.title}
        meta={
          <>
            {playlist.description && <p className="mb-2 max-w-2xl leading-relaxed text-foreground/80">{playlist.description}</p>}
            <span className="inline-flex items-center gap-1.5">
              {playlist.isPrivate ? <Lock size={13} aria-hidden /> : <Globe size={13} aria-hidden />}
              {playlist.isPrivate ? 'Private' : 'Public'}
              {playlist.trackCount ? ` · ${playlist.trackCount} works` : ''}
            </span>
          </>
        }
        actions={
          <>
            <HeroPlayButton onClick={() => void playAll()} />
            {playlist.isEditable && (
              <Button variant="secondary" icon={Pencil} className="h-11 border-white/15 bg-white/[0.07] px-5 hover:bg-white/15" onClick={() => setEditing((v) => !v)}>
                {editing ? 'Close editor' : 'Edit'}
              </Button>
            )}
          </>
        }
      />

      {editing && (
        <EditPlaylist
          playlist={playlist}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
          onDeleted={() => navigate('/library')}
        />
      )}

      {feed.isPending && <CardSkeletons count={6} />}
      {feed.error && <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />}
      {feed.data && <FeedView feed={feed.data} onExpired={() => void feed.refetch()} emptyText="This playlist is empty." />}
    </>
  );
}

function EditPlaylist({
  playlist, onClose, onSaved, onDeleted,
}: {
  playlist: Playlist;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description ?? '');
  const [isPrivate, setIsPrivate] = useState(playlist.isPrivate);
  const [busy, setBusy] = useState(false);
  const editMutation = usePlaylistEdit(playlist);
  const deleteMutation = usePlaylistDelete(playlist);

  const save = async () => {
    setBusy(true);
    try {
      await editMutation.mutateAsync({ title: title.trim() || playlist.title, description: description.trim() || null, isPrivate });
      toast('Playlist saved');
      onSaved();
    } catch (e) {
      toast(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${playlist.title}”? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteMutation.mutateAsync();
      toast('Playlist deleted');
      onDeleted();
    } catch (e) {
      toast(messageFor(e));
      setBusy(false);
    }
  };

  return (
    <section className="mb-10 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-label="Edit playlist">
      <div className="mb-5 flex items-center gap-2 text-sm font-medium"><ListMusic size={16} className="text-primary" aria-hidden /> Edit playlist</div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="pl-name">Name</Label>
          <Input id="pl-name" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Visibility</Label>
          <label className="flex h-9 cursor-pointer items-center justify-between rounded-md border border-input px-3">
            <span className="text-sm">{isPrivate ? 'Private' : 'Public'}</span>
            <Checkbox checked={isPrivate} onCheckedChange={(v) => setIsPrivate(v === true)} />
          </label>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pl-desc">Description</Label>
          <Textarea id="pl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-1.5 text-sm text-red-300 transition hover:text-red-200 disabled:opacity-40">
          <Trash2 size={15} aria-hidden /> Delete playlist
        </button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>Save changes</Button>
        </div>
      </div>
    </section>
  );
}
