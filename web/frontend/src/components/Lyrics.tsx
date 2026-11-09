import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Mic2 } from 'lucide-react';
import { lyricsOptions } from '../api/queries';
import type { Track } from '../api/types';
import { seek } from '../player/engine';
import { usePlayer } from '../player/store';
import { cn } from '@/lib/utils';

/**
 * Synced lyrics on a full-screen stage. The active line is large and bright; lines fade and
 * shrink with distance. Click a line to seek to it. The list scrolls to keep the active line centred.
 */
export function LyricsView({ track }: { track: Track }) {
  const query = useQuery(lyricsOptions(track));
  const position = usePlayer((s) => s.position);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const lyrics = query.data?.lyrics;
  const timed = lyrics && lyrics.type.endsWith('Timed') ? lyrics.list ?? [] : null;
  const ms = position * 1000;
  const activeIndex = timed ? timed.findIndex((l) => ms >= l.startTime && ms < l.endTime) : -1;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIndex]);

  if (query.isPending) {
    return (
      <div className="flex h-full flex-col justify-center gap-6 px-8">
        {[70, 50, 60].map((w) => (
          <div key={w} className="h-9 animate-pulse rounded-md bg-white/10" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }
  if (query.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-white/70">
        <AlertCircle size={28} aria-hidden />
        <p>Lyrics couldn't be loaded.</p>
      </div>
    );
  }
  if (!lyrics) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-white/60">
        <Mic2 size={28} aria-hidden />
        <p>No lyrics for this track.</p>
      </div>
    );
  }
  if (!timed) {
    return (
      <div className="scroll-thin h-full overflow-y-auto px-8 py-12 md:py-16">
        <p className="whitespace-pre-line text-2xl leading-relaxed text-white/80">{(lyrics as { text?: string }).text ?? ''}</p>
      </div>
    );
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto px-6 md:px-12 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]">
      <ol className="flex flex-col gap-6 py-[28vh] md:py-[38vh]">
        {timed.map((line, i) => {
          const active = i === activeIndex;
          const past = activeIndex >= 0 && i < activeIndex;
          const progress = active
            ? Math.min(100, Math.max(0, ((ms - line.startTime) / Math.max(1, line.endTime - line.startTime)) * 100))
            : 0;
          return (
            <li key={`${line.startTime}-${i}`}>
              <button
                ref={active ? activeRef : undefined}
                type="button"
                onClick={() => seek(line.startTime / 1000)}
                style={active ? ({ '--lyric-p': `${progress}%` } as React.CSSProperties) : undefined}
                className={cn(
                  // One font size for every line: the active line never changes size.
                  'block w-full text-left text-3xl font-semibold leading-snug transition-opacity duration-500 ease-[cubic-bezier(0.2,0,0,1)] md:text-4xl',
                  active ? 'lyric-active opacity-100' : past ? 'text-white opacity-45 hover:opacity-80' : 'text-white opacity-30 hover:opacity-70',
                )}
              >
                {line.text}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
