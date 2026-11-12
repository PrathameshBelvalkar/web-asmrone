import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { messageFor } from "../lib/errors";
import { toast } from "../lib/toast";
import type { Playlist, MediaItem, Track, User } from "./types";

/** Like or unlike a work or track. The cached state updates straight away. */
export function useLike(item: MediaItem) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shouldLike: boolean) => api.like(item, shouldLike),
    onMutate: async (shouldLike) => {
      await queryClient.cancelQueries({ queryKey: ["like", item.id] });
      const previous = queryClient.getQueryData<{ liked: boolean }>([
        "like",
        item.id,
      ]);
      queryClient.setQueryData(["like", item.id], { liked: shouldLike });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(["like", item.id], context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["like", item.id] });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      data,
    }: {
      key: string;
      data: Record<string, string>;
    }) => api.login(key, data),
    onSuccess: (user: User) => {
      queryClient.setQueryData(["me"], user);
      void queryClient.invalidateQueries({ queryKey: ["home"] });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      queryClient.setQueryData(["me"], null);
      void queryClient.invalidateQueries({ queryKey: ["home"] });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

export function useSetSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      api.putSetting(key, value),
    onSuccess: () => {
      // Settings change what most screens show (titles and their language, lyrics, home, search),
      // so everything is fetched again when next shown.
      void queryClient.invalidateQueries({
        queryKey: ["settings"],
        refetchType: "all",
      });
      void queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] !== "settings" &&
          q.queryKey[0] !== "me" &&
          q.queryKey[0] !== "forms",
      });
    },
  });
}

/** Playlist writes all refresh the library, the playlist lists and any open playlist. */
function refreshPlaylists(
  queryClient: ReturnType<typeof useQueryClient>,
  playlistId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: ["library"] });
  void queryClient.invalidateQueries({ queryKey: ["editable"] });
  if (playlistId)
    void queryClient.invalidateQueries({
      queryKey: ["playlistTracks", playlistId],
    });
}

export function usePlaylistCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      title,
      description,
    }: {
      title: string;
      description: string | null;
    }) => api.playlistCreate(title, description),
    onSuccess: () => refreshPlaylists(queryClient),
  });
}

export function useAddToPlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playlist, track }: { playlist: Playlist; track: Track }) =>
      api.playlistAddTrack(playlist, track),
    onSuccess: (_data, { playlist }) =>
      refreshPlaylists(queryClient, playlist.id),
  });
}

export function usePlaylistEdit(playlist: Playlist) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      title,
      description,
      isPrivate,
    }: {
      title: string;
      description: string | null;
      isPrivate: boolean;
    }) => {
      await api.playlistEdit(playlist, title, description);
      if (isPrivate !== playlist.isPrivate)
        await api.playlistPrivacy(playlist, isPrivate);
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

/* AI subtitle setup. Every change refreshes the tools status; errors are shown as a toast. */

function useToolsMutation<T = void>(
  mutationFn: (arg: T) => Promise<void>,
  after?: (queryClient: ReturnType<typeof useQueryClient>) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tools"] });
      after?.(queryClient);
    },
    onError: (error) => toast(messageFor(error)),
  });
}

export function useSetupTools() {
  return useToolsMutation(() => api.setupTools());
}

export function useDownloadModel() {
  return useToolsMutation((id: string) => api.downloadModel(id));
}

export function usePauseDownload() {
  return useToolsMutation(() => api.pauseDownload());
}

/** Cancel: stops the download and deletes its partial file. */
export function useCancelDownload() {
  return useToolsMutation(() => api.cancelDownload());
}

/** Choosing a model changes which subtitles are used, so lyrics are fetched again. */
export function useSelectModel() {
  return useToolsMutation(
    (id: string) => api.selectModel(id),
    (queryClient) =>
      void queryClient.invalidateQueries({ queryKey: ["lyrics"] }),
  );
}

export function useDeleteModel() {
  return useToolsMutation((id: string) => api.deleteModel(id));
}

export function useRunBenchmark() {
  return useToolsMutation(() => api.runBenchmark());
}
