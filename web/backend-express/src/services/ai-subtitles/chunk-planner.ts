/** A time range in milliseconds, end exclusive. */
export interface Interval {
  readonly start: number;
  readonly end: number;
}

/** Pieces are cut at a quiet moment between these lengths. Whisper reads 30 s at a time. */
export const MIN_PIECE_MS = 18_000;
export const MAX_PIECE_MS = 28_000;
/** Shorter pieces when the listener is at a moment with no subtitles yet, so lines show up sooner. */
export const QUICK_MIN_PIECE_MS = 8_000;
export const QUICK_MAX_PIECE_MS = 12_000;
/** When starting at the listening position, the cut is looked for this far before it. */
const LEAD_IN_MS = 3_000;
/** A gap this small before the listening position is filled in rather than skipped. */
const SNAP_BACK_MS = 8_000;

/** Adds a range to a sorted list of non-overlapping ranges, merging touching ones. */
export function addInterval(list: readonly Interval[], add: Interval): Interval[] {
  const all = [...list, add].sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const iv of all) {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end)
      out[out.length - 1] = { start: last.start, end: Math.max(last.end, iv.end) };
    else out.push({ ...iv });
  }
  return out;
}

export function totalCovered(list: readonly Interval[]): number {
  return list.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
}

/** The first moment at or after `from` that is not covered. */
export function firstUncovered(list: readonly Interval[], from: number): number {
  let point = from;
  for (const iv of list) {
    if (iv.start <= point && point < iv.end) point = iv.end;
  }
  return point;
}

export interface PlanInput {
  /** Already transcribed, sorted. */
  readonly covered: readonly Interval[];
  /** Where the listener is, in ms. */
  readonly focusMs: number;
  /** Audio decoded so far, in ms. */
  readonly availableMs: number;
  /** True when `availableMs` is the whole track. */
  readonly done: boolean;
  /** The quietest moment between two times (both within the available audio). */
  readonly quietPoint: (fromMs: number, toMs: number) => Promise<number>;
}

export type Plan =
  | { readonly kind: 'piece'; readonly piece: Interval }
  | { readonly kind: 'wait' }
  | { readonly kind: 'complete' };

/**
 * The next piece to transcribe: from the listening position onwards first, then any earlier gap.
 * Pieces start and end at quiet moments (or at an already-covered range, or the end of the track),
 * so they line up without overlapping. `wait` means more audio is needed first.
 */
export async function planNextPiece(input: PlanInput): Promise<Plan> {
  const { covered, focusMs, availableMs, done } = input;
  const trackEnd = done ? availableMs : Infinity;

  const fromFocus = firstUncovered(covered, Math.max(0, focusMs));
  const fromStart = firstUncovered(covered, 0);
  if (done && fromStart >= trackEnd) return { kind: 'complete' };

  // The listener is at a moment with nothing transcribed yet.
  const listenerWaiting = fromFocus === Math.max(0, focusMs);
  for (const candidate of [fromFocus, fromStart]) {
    if (candidate >= trackEnd || candidate >= availableMs) continue;
    const quick = listenerWaiting && candidate === fromFocus;
    const start = await pieceStart(input, candidate);
    const end = await pieceEnd(
      input,
      start,
      trackEnd,
      quick ? QUICK_MIN_PIECE_MS : MIN_PIECE_MS,
      quick ? QUICK_MAX_PIECE_MS : MAX_PIECE_MS,
    );
    if (end !== null && end > start) return { kind: 'piece', piece: { start, end } };
  }
  return { kind: 'wait' };
}

/** A piece starting at an uncovered moment: snaps back to a nearby covered end, or to a quiet moment just before. */
async function pieceStart(input: PlanInput, point: number): Promise<number> {
  const previousEnd = input.covered
    .filter((iv) => iv.end <= point)
    .reduce((max, iv) => Math.max(max, iv.end), 0);
  if (point - previousEnd <= SNAP_BACK_MS) return previousEnd;
  return input.quietPoint(Math.max(previousEnd, point - LEAD_IN_MS), point);
}

/** Where a piece starting at `start` ends, or null when more audio is needed to decide. */
async function pieceEnd(
  input: PlanInput,
  start: number,
  trackEnd: number,
  minMs: number,
  maxMs: number,
): Promise<number | null> {
  const nextCovered = input.covered.find((iv) => iv.start > start)?.start ?? Infinity;
  const boundary = Math.min(nextCovered, trackEnd);
  if (boundary - start <= maxMs) {
    return boundary <= input.availableMs ? boundary : null;
  }
  if (input.availableMs < start + maxMs) return null;
  return input.quietPoint(start + minMs, start + maxMs);
}
