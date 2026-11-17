import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { proxyUrl } from '../../api/client';
import { IconButton } from '../ui';
import { JavImage } from './JavImage';

type Sample = { thumb: string; full: string };

/**
 * A movie's sample images as a grid of thumbnails. Clicking one opens a full-window viewer: ← and →
 * (or a swipe) move through them, Esc closes it, and the images either side are loaded ahead.
 */
export function SampleGallery({ samples, title }: { samples: Sample[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <ol className="stagger grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
        {samples.map((s, i) => (
          <li key={s.full} style={{ '--i': i % 24 } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open image ${i + 1} of ${samples.length}`}
              className="block w-full rounded-lg transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <JavImage src={s.thumb} fallbacks={[s.full]} className="aspect-[3/2] w-full rounded-lg shadow-md shadow-black/40" />
            </button>
          </li>
        ))}
      </ol>
      {open !== null && <SampleViewer samples={samples} start={open} title={title} onClose={() => setOpen(null)} />}
    </>
  );
}

function SampleViewer({ samples, start, title, onClose }: { samples: Sample[]; start: number; title: string; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const [failed, setFailed] = useState(0);
  const touch = useRef<number | null>(null);
  const count = samples.length;
  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + count) % count);
      setFailed(0);
    },
    [count],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
      // The shell uses Space and other keys for the player; the viewer has them while it's open.
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
    };
  }, [go, onClose]);

  // Load the images either side so moving through them is instant.
  useEffect(() => {
    for (const d of [1, -1]) {
      const s = samples[(index + d + count) % count];
      if (s) new Image().src = s.full;
    }
  }, [index, samples, count]);

  const sample = samples[index]!;
  // The large image, then the thumbnail, then each through the proxy.
  const candidates = [sample.full, sample.thumb, proxyUrl(sample.full), proxyUrl(sample.thumb)];
  const src = candidates[failed];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title}: image ${index + 1} of ${count}`}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
      onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const from = touch.current;
        const to = e.changedTouches[0]?.clientX;
        touch.current = null;
        if (from === null || to === undefined || Math.abs(to - from) < 40) return;
        go(to < from ? 1 : -1);
      }}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <p className="min-w-0 flex-1 truncate text-sm text-white/80">{title}</p>
        <span className="text-sm text-white/70 tnum">
          {index + 1} / {count}
        </span>
        <IconButton icon={X} label="Close" onClick={onClose} className="text-white hover:bg-white/10" />
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-16">
        {src ? (
          <img
            key={src}
            src={src}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setFailed((n) => n + 1)}
            className="max-h-full max-w-full select-none object-contain"
          />
        ) : (
          <p className="text-sm text-white/70">This image couldn't be loaded.</p>
        )}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex"
            >
              <ChevronLeft size={22} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex"
            >
              <ChevronRight size={22} aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
