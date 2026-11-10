import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, LoaderCircle, Mic2, Sparkles } from 'lucide-react';
import { aiSubtitlesPending, lyricsOptions } from '../api/queries';
import type { AiStatus, Lyrics, Track } from '../api/types';
import { formatTime } from '../lib/media';
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
  const ai = query.data?.extras?.aiGenerated ? query.data : null;
  if (!lyrics) {
    if (ai) return <AiEmptyState data={ai} />;
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
    <div className="relative h-full">
      {ai && <AiBadge data={ai} positionMs={ms} />}
      <div className="scroll-thin h-full overflow-y-auto px-6 md:px-12 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]">
        <ol className="flex flex-col gap-6 py-[28vh] md:py-[38vh]">
          {timed.map((line, i) => {
            const active = i === activeIndex;
            const past = activeIndex >= 0 && i < activeIndex;
            return (
              <li key={`${line.startTime}-${i}`}>
                <button
                  ref={active ? activeRef : undefined}
                  type="button"
                  onClick={() => seek(line.startTime / 1000)}
                  className={cn(
                    // One font size for every line: the active line never changes size. Lines are
                    // only timed per line (not per word), so the active line is lit as a whole.
                    'block w-full text-left text-3xl font-semibold leading-snug transition-opacity duration-500 ease-[cubic-bezier(0.2,0,0,1)] md:text-4xl',
                    active ? 'text-white opacity-100' : past ? 'text-white opacity-45 hover:opacity-80' : 'text-white opacity-30 hover:opacity-70',
                  )}
                >
                  {line.text}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** "Starting…", "Transcribed 3:00 / 24:00". */
function aiProgressText(data: Lyrics): string {
  const extras = data.extras ?? {};
  if (extras.aiPhase !== 'transcribing') return 'Starting…';
  const covered = formatTime(Number(extras.aiCoveredMs ?? 0) / 1000);
  return extras.aiTotalMs ? `Transcribed ${covered} / ${formatTime(Number(extras.aiTotalMs) / 1000)}` : `Transcribed ${covered}`;
}

function aiPercent(data: Lyrics): number {
  const extras = data.extras ?? {};
  if (!extras.aiTotalMs) return 0;
  return Math.min(100, Math.max(0, (Number(extras.aiCoveredMs ?? 0) / Number(extras.aiTotalMs)) * 100));
}

/** Whether the server has transcribed the moment at `ms` yet (`extras.aiCovered` is "start-end,…"). */
function aiCovers(data: Lyrics, ms: number): boolean {
  return (data.extras?.aiCovered ?? '').split(',').some((range) => {
    const [start, end] = range.split('-').map(Number);
    return start !== undefined && end !== undefined && ms >= start && ms < end;
  });
}

/** Small label over AI subtitles: progress while they are being made, then "AI generated". */
function AiBadge({ data, positionMs }: { data: Lyrics; positionMs: number }) {
  const pending = aiSubtitlesPending(data);
  const text = !pending
    ? data.extras?.aiStatus === 'failed'
      ? 'AI subtitles stopped early'
      : 'Subtitles are AI generated'
    : aiCovers(data, positionMs)
      ? `AI subtitles · ${aiProgressText(data)}`
      : 'AI subtitles · Transcribing this part…';
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-4">
      <div className="flex max-w-full items-center gap-2 overflow-hidden rounded-full bg-black/40 px-3 py-1 text-xs text-white/75 backdrop-blur" role="status">
        {pending ? <LoaderCircle size={13} className="shrink-0 animate-spin" aria-hidden /> : <Sparkles size={13} className="shrink-0" aria-hidden />}
        <span className="truncate">{text}</span>
      </div>
    </div>
  );
}

/** AI subtitles with no lines yet: in progress, failed, not set up, or no speech found. */
function AiEmptyState({ data }: { data: Lyrics }) {
  const status = data.extras?.aiStatus as AiStatus | undefined;
  const message = data.extras?.aiMessage;
  if (status === 'running') {
    const percent = aiPercent(data);
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center text-white/70" role="status">
        <LoaderCircle size={28} className="animate-spin" aria-hidden />
        <div className="space-y-1">
          <p className="text-lg font-medium text-white/90">Making AI subtitles</p>
          <p className="text-sm tnum">{aiProgressText(data)}</p>
        </div>
        <div className="h-1 w-56 max-w-full overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-white/80 transition-[width] duration-700" style={{ width: `${percent}%` }} />
        </div>
        <p className="max-w-sm text-xs text-white/50">Lines appear in a few seconds, starting where you're listening. The result is saved, so each track is only transcribed once.</p>
      </div>
    );
  }
  const title =
    status === 'unavailable' ? "AI subtitles aren't set up" : status === 'failed' ? "AI subtitles couldn't be made" : 'No speech found in this track';
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-white/60">
      {status === 'done' ? <Mic2 size={28} aria-hidden /> : <AlertCircle size={28} aria-hidden />}
      <p>{title}</p>
      {message && <p className="max-w-md break-words text-xs text-white/45">{message}</p>}
    </div>
  );
}
