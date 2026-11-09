import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { Playlist, MediaItem, Track, User } from './types';

/** Like or unlike a work or track. The cached state updates straight away. */
export function useLike(item: MediaItem) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shouldLike: boolean) => api.like(item, shouldLike),
    onMutate: async (shouldLike) => {
      await queryClient.cancelQueries({ queryKey: ['like', item.id] });
      const previous = queryClient.getQueryData<{ liked: boolean }>(['like', item.id]);
      queryClient.setQueryData(['like', item.id], { liked: shouldLike });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['like', item.id], context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['like', item.id] });
      void queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: Record<string, string> }) => api.login(key, data),
    onSuccess: (user: User) => {
      queryClient.setQueryData(['me'], user);
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      void queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      queryClient.setQueryData(['me'], null);
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      void queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });
}

export function useSetSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => api.putSetting(key, value),
    onSuccess: () => {
      // Settings change what home and search return.
      void queryClient.invalidateQueries({ queryKey: ['settings'], refetchType: 'all' });
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      void queryClient.invalidateQueries({ queryKey: ['search'] });
      void queryClient.invalidateQueries({ queryKey: ['quick'] });
    },
  });
}

/** Playlist writes all refresh the library, the playlist lists and any open playlist. */
function refreshPlaylists(queryClient: ReturnType<typeof useQueryClient>, playlistId?: string) {
  void queryClient.invalidateQueries({ queryKey: ['library'] });
  void queryClient.invalidateQueries({ queryKey: ['editable'] });
  if (playlistId) void queryClient.invalidateQueries({ queryKey: ['playlistTracks', playlistId] });
}

export function usePlaylistCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, description }: { title: string; description: string | null }) =>
      api.playlistCreate(title, description),
    onSuccess: () => refreshPlaylists(queryClient),
  });
}

export function useAddToPlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playlist, track }: { playlist: Playlist; track: Track }) => api.playlistAddTrack(playlist, track),
    onSuccess: (_data, { playlist }) => refreshPlaylists(queryClient, playlist.id),
  });
}

export function usePlaylistEdit(playlist: Playlist) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, description, isPrivate }: { title: string; description: string | null; isPrivate: boolean }) => {
      await api.playlistEdit(playlist, title, description);
      if (isPrivate !== playlist.isPrivate) await api.playlistPrivacy(playlist, isPrivate);
    },
    onSuccess: () => refreshPlaylists(queryClient, playlist.id),
  });
}

export function usePlaylistDelete(playlist: Playlist) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.playlistDelete(playlist),
    onSuccess: () => refreshPlaylists(queryClient, playlist.id),
  });
}
