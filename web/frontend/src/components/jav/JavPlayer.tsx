import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { useQuery } from '@tanstack/react-query';
import { ApiError, api, proxyUrl } from '../../api/client';

interface Level {
  index: number;
  label: string;
}

/**
 * The full movie, from its STREAM SB stream (docs/JAV.md section 11). The stream is asked for only
 * when this mounts. The playlists load through the proxy; the video segments load from their CDN.
 */
export function JavPlayer({ kind, slug, poster, className }: { kind: string; slug: string; poster?: string; className: string }) {
  const stream = useQuery({
    queryKey: ['jav', 'stream', kind, slug],
    queryFn: () => api.jav.stream(kind, slug),
    // The host's links expire; the server hands out the same one for an hour.
    staleTime: 30 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  });
  const video = useRef<HTMLVideoElement>(null);
  const hls = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [level, setLevel] = useState(-1);
  const [failed, setFailed] = useState(false);
  const master = stream.data?.master;

  useEffect(() => {
    const el = video.current;
    if (!master || !el) return;
    setFailed(false);
    const playlist = proxyUrl(master);
    if (!Hls.isSupported()) {
      if (el.canPlayType('application/vnd.apple.mpegurl')) el.src = playlist;
      else setFailed(true);
      return;
    }
    const instance = new Hls();
    instance.on(Hls.Events.MANIFEST_PARSED, () => {
      setLevels(
        instance.levels
          .map((l, index) => ({ index, height: l.height, label: l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)} kbps` }))
          .sort((a, b) => b.height - a.height)
          .map(({ index, label }) => ({ index, label })),
      );
    });
    instance.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) setFailed(true);
    });
    instance.loadSource(playlist);
    instance.attachMedia(el);
    hls.current = instance;
    return () => {
      instance.destroy();
      hls.current = null;
      setLevels([]);
      setLevel(-1);
    };
  }, [master]);

  const message = stream.error ? errorText(stream.error) : failed ? 'This stream could not be played.' : null;

  return (
    <div>
      {message ? (
        <div className={`${className} grid place-items-center bg-black/60 p-6 text-center text-sm text-muted-foreground`} role="status">
          {message}
        </div>
      ) : (
        <video ref={video} className={`${className} bg-black`} poster={poster} controls playsInline aria-busy={stream.isPending} />
      )}
      <div className="mt-3 flex min-h-9 items-center gap-3 text-sm">
        {stream.isPending && <span className="text-muted-foreground">Finding the stream…</span>}
        {message && stream.error instanceof ApiError && stream.error.status === 503 && (
          <button
            type="button"
            onClick={() => void stream.refetch()}
            className="inline-flex h-9 items-center rounded-full border border-white/15 px-4 font-medium hover:border-white/30 hover:bg-white/10"
          >
            Try again
          </button>
        )}
        {!message && levels.length > 1 && (
          <label className="inline-flex items-center gap-2 text-foreground/70">
            Quality
            <select
              value={level}
              onChange={(e) => {
                const next = Number(e.target.value);
                setLevel(next);
                if (hls.current) hls.current.currentLevel = next;
              }}
              className="h-9 rounded-full border border-white/15 bg-transparent px-3 text-foreground"
            >
              <option value={-1}>Auto</option>
              {levels.map((l) => (
                <option key={l.index} value={l.index}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

function errorText(error: Error): string {
  if (!(error instanceof ApiError)) return 'The stream could not be loaded.';
  if (error.status === 404) return error.message || 'No stream was found for this movie.';
  if (error.status === 451) return "This title isn't available in Echo.";
  if (error.status === 503) return 'The stream source is busy. Try again later.';
  return 'The stream could not be found on its host.';
}
