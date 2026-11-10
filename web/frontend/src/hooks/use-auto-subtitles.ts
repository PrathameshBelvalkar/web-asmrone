import { useEffect } from 'react';
import { lyricsOptions } from '../api/queries';
import { queryClient } from '../lib/queryClient';
import { usePlayer } from '../player/store';

/**
 * While playing, asks for lyrics of the playing track and the one after it whenever the track changes. For a
 * track without a subtitle file, that request makes the server start AI subtitles in the background,
 * so they are ready (or well along) by the time the lyrics view is opened or the next track plays.
 */
export function useAutoSubtitles(): void {
  const current = usePlayer((s) => (s.index >= 0 ? s.queue[s.index] : undefined));
  const next = usePlayer((s) => (s.index >= 0 ? s.queue[s.index + 1] : undefined));
  // A queue restored on page load doesn't start work until something plays.
  const playing = usePlayer((s) => s.playing);

  useEffect(() => {
    if (!current || !playing) return;
    let cancelled = false;
    // Next first, then current: the server runs the most recently asked-for track first.
    const prefetch = async () => {
      if (next) await queryClient.prefetchQuery(lyricsOptions(next));
      if (!cancelled) await queryClient.prefetchQuery(lyricsOptions(current));
    };
    void prefetch();
    return () => {
      cancelled = true;
    };
  }, [current, next, playing]);
}
