import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { HanimeStoryboard } from '../../api/types';
import { duration } from '../../lib/hanime';

/** As many frames as hanime.tv's Preview shows. */
const FRAMES = 14;

/**
 * The frames to show: FRAMES of the storyboard's tiles, evenly spread from start to end, each with
 * the time it shows when the length is known.
 */
export function previewFrames(board: HanimeStoryboard, durationSec: number | null, count = FRAMES): { tile: number; at: number | null }[] {
  const n = Math.min(count, board.tiles);
  return Array.from({ length: n }, (_, i) => {
    const tile = n === 1 ? 0 : Math.round((i * (board.tiles - 1)) / (n - 1));
    return { tile, at: durationSec === null ? null : Math.round(((tile + 0.5) / board.tiles) * durationSec) };
  });
}

/** CSS that shows one tile of the sprite, filling its box. */
function tileStyle(board: HanimeStoryboard, tile: number): React.CSSProperties {
  const col = tile % board.columns;
  const row = Math.floor(tile / board.columns);
  return {
    backgroundImage: `url("${board.url}")`,
    backgroundSize: `${board.columns * 100}% ${board.rows * 100}%`,
    backgroundPosition: `${board.columns > 1 ? (col / (board.columns - 1)) * 100 : 0}% ${board.rows > 1 ? (row / (board.rows - 1)) * 100 : 0}%`,
    backgroundRepeat: 'no-repeat',
  };
}

/** The Preview: frames cut from the storyboard. Clicking one opens it large, with ← and → to step through. */
export function PreviewFrames({ board, durationSec, title }: { board: HanimeStoryboard; durationSec: number | null; title: string }) {
  const frames = previewFrames(board, durationSec);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
        {frames.map((f, i) => (
          <button
            key={f.tile}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Preview frame ${i + 1}${f.at !== null ? ` at ${duration(f.at)}` : ''}`}
            className="group relative aspect-video overflow-hidden rounded-lg bg-muted ring-offset-background transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            style={tileStyle(board, f.tile)}
          >
            {f.at !== null && (
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1 py-px text-[0.65rem] font-medium text-white tnum">{duration(f.at)}</span>
            )}
          </button>
        ))}
      </div>
      {open !== null && <Viewer board={board} frames={frames} index={open} onIndex={setOpen} onClose={() => setOpen(null)} title={title} />}
    </>
  );
}

function Viewer({
  board, frames, index, onIndex, onClose, title,
}: {
  board: HanimeStoryboard;
  frames: { tile: number; at: number | null }[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  title: string;
}) {
  const step = useCallback((d: number) => onIndex((index + d + frames.length) % frames.length), [index, frames.length, onIndex]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step]);
  const frame = frames[index];
  if (!frame) return null;
  return createPortal(
    <div role="dialog" aria-modal aria-label={`${title}: preview`} className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-xl shadow-2xl" style={tileStyle(board, frame.tile)} onClick={(e) => e.stopPropagation()} />
      <p className="mt-3 text-sm text-white/80 tnum">
        {index + 1} / {frames.length}
        {frame.at !== null && ` · ${duration(frame.at)}`}
      </p>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
        <X size={20} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Previous frame"
        onClick={(e) => {
          e.stopPropagation();
          step(-1);
        }}
        className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <ChevronLeft size={22} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Next frame"
        onClick={(e) => {
          e.stopPropagation();
          step(1);
        }}
        className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <ChevronRight size={22} aria-hidden />
      </button>
    </div>,
    document.body,
  );
}
