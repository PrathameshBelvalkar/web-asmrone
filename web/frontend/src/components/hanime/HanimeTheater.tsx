import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, RotateCw, X } from 'lucide-react';
import { ApiError } from '../../api/client';
import { hanimeStreamOptions } from '../../api/queries';
import { recordHentaiWatch, resumeAt, useHentaiEntry } from '../../lib/history';
import { Notice, Player, THEATER_BOX } from '../jav/JavTheater';

const BUTTON =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-foreground/70 hover:bg-white/10 hover:text-foreground';

/**
 * The player across the top of a Hanime title page (docs/HANIME.md section 12). The server finds the
 * title's episode page on hentaibros.net and reads its MP4, which plays from its host. It picks up
 * where you left off (unless [fromStart]) and saves your place for the Library.
 */
export function HanimeTheater({
  slug, title, poster, cover, fromStart = false, onClose,
}: {
  slug: string;
  title: string;
  poster?: string;
  /** The portrait cover, kept with your place for the Library. */
  cover: string | null;
  fromStart?: boolean;
  onClose: () => void;
}) {
  const stream = useQuery(hanimeStreamOptions(slug));
  const entry = useHentaiEntry(slug);
  // Read once: later saves must not move the start point.
  const [start] = useState(() => (fromStart ? null : resumeAt(entry)));
  const top = useRef<HTMLElement>(null);
  useEffect(() => {
    top.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, []);

  return (
    // The negative margins undo the page padding (Shell's <main>), as on a JAV movie page.
    <section
      ref={top}
      aria-label="Player"
      className="-mx-4 -mt-4 mb-10 scroll-mt-16 sm:-mx-6 sm:-mt-6 lg:-mx-10"
      style={{ animation: 'rise 400ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
    >
      {stream.error ? (
        <Problem error={stream.error} onRetry={() => void stream.refetch()} />
      ) : !stream.data ? (
        <div className={`${THEATER_BOX} grid place-items-center`} role="status">
          <div className="flex flex-col items-center gap-3 text-sm text-white/70">
            <span className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-primary" aria-hidden />
            Finding the video…
          </div>
        </div>
      ) : (
        <Player
          src={{ src: stream.data.file, type: /\.m3u8$/i.test(stream.data.file) ? 'application/x-mpegurl' : 'video/mp4' }}
          title={title}
          poster={poster}
          start={start}
          onSave={(position, duration, now) => recordHentaiWatch({ slug, title, cover }, position, duration, now)}
          failText="The video host didn’t send this video. Try again later."
        />
      )}
      <div className="px-4 sm:px-6 lg:px-10">
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="min-w-0 truncate text-sm text-foreground/70">
            <span className="font-semibold text-foreground">{title}</span>
            {stream.data && ' · from hentaibros.net'}
          </p>
          <div className="flex items-center gap-1">
            {stream.data && (
              <a href={stream.data.page} target="_blank" rel="noreferrer noopener" className={BUTTON}>
                <ExternalLink size={16} aria-hidden /> Source
              </a>
            )}
            <button type="button" onClick={onClose} className={BUTTON}>
              <X size={16} aria-hidden /> Close
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Problem({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  const text =
    status === 404
      ? 'hentaibros.net has no video for this title.'
      : status === 451
        ? "This title isn't available in NekoHub."
        : status === 503
          ? 'hentaibros.net is busy. Try again later.'
          : 'The video couldn’t be found.';
  return (
    <Notice
      title={text}
      action={
        status !== 404 &&
        status !== 451 && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-white/20 px-4 text-sm font-medium text-white hover:bg-white/10"
          >
            <RotateCw size={15} aria-hidden /> Try again
          </button>
        )
      }
    />
  );
}
