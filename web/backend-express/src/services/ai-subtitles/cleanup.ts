import type { TimedLine } from '../../models/ai-subtitles.js';

/** Phrases Whisper invents over silence or noise (it learnt them from video captions). */
const FILLER = [
  /ご視聴(いただき)?ありがとうございました/,
  /チャンネル登録/,
  /高評価/,
  /字幕(は|を|作成|提供)/,
  /subtitles? by/i,
  /amara\.org/i,
  /thank(s| you) for watching/i,
];

/** Only punctuation, symbols or music notes, e.g. "♪", "…", "。". */
const SYMBOLS_ONLY = /^[\s\p{P}\p{S}]*$/u;
/** A whole line in brackets, e.g. "(音楽)", "（拍手）", "[笑い]". */
const BRACKETED = /^[(（[【〔][^)）\]】〕]*[)）\]】〕]$/u;
/** A short unit repeated many times, e.g. "あっあっあっあっあっあっあっ". */
const LONG_REPEAT = /(.{1,6}?)\1{4,}/gu;

/** Identical lines in a row longer than this are treated as a hallucination loop. */
const MAX_SAME_IN_A_ROW = 2;

/** Lines at least this long (time or characters) are split into sentences. */
const SPLIT_MIN_MS = 6_000;
const SPLIT_MIN_CHARS = 24;
/** A sentence still longer than this is also split at commas. */
const COMMA_SPLIT_CHARS = 30;
/** Pieces shorter than this are joined to a neighbour. */
const PIECE_MIN_CHARS = 4;

/**
 * Removes typical Whisper mistakes from a transcript: filler phrases, symbol-only and bracketed
 * sound labels, runaway repetition inside a line, and loops of the same line. Long lines are then
 * split into sentences. Keeps time order.
 */
export function cleanTranscript(lines: readonly TimedLine[]): TimedLine[] {
  const out: TimedLine[] = [];
  let sameCount = 0;
  const sorted = [...lines].sort((a, b) => a.start - b.start);
  for (const line of sorted) {
    const text = normalise(line.text);
    if (text.length === 0 || SYMBOLS_ONLY.test(text) || BRACKETED.test(text)) continue;
    if (FILLER.some((re) => re.test(text))) continue;

    const prev = out[out.length - 1];
    if (prev && prev.text === text) {
      sameCount += 1;
      // Two in a row become one longer line; more than that is a loop, so the rest is dropped.
      if (sameCount < MAX_SAME_IN_A_ROW)
        out[out.length - 1] = { ...prev, end: Math.max(prev.end, line.end) };
      continue;
    }
    sameCount = 0;
    out.push({ start: line.start, end: Math.max(line.end, line.start + 1), text });
  }
  return out.flatMap(splitLongLine);
}

/**
 * Splits a long line (Whisper often returns 10–15 s with several sentences) at sentence ends and
 * pauses, so each shown line is one sentence. Whisper's per-word times are unreliable, so the
 * line's time is shared out by character count; every piece stays inside the original line.
 */
export function splitLongLine(line: TimedLine): TimedLine[] {
  if (line.end - line.start < SPLIT_MIN_MS && spoken(line.text) < SPLIT_MIN_CHARS) return [line];
  const sentences = line.text
    .split(/(?<=[。！？!?…])|\s+/u)
    .flatMap((part) => (spoken(part) > COMMA_SPLIT_CHARS ? part.split(/(?<=[、，,])/u) : [part]))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const pieces: string[] = [];
  for (const part of sentences) {
    const last = pieces.length - 1;
    if (
      last >= 0 &&
      (spoken(part) < PIECE_MIN_CHARS || spoken(pieces[last] ?? '') < PIECE_MIN_CHARS)
    ) {
      pieces[last] = joinJa(pieces[last] ?? '', part);
    } else {
      pieces.push(part);
    }
  }
  if (pieces.length <= 1) return [line];

  const weights = pieces.map((p) => Math.max(1, spoken(p)));
  const total = weights.reduce((a, b) => a + b, 0);
  const duration = line.end - line.start;
  let before = 0;
  return pieces.map((text, i) => {
    const start = line.start + Math.round((duration * before) / total);
    before += weights[i] ?? 1;
    const end =
      i === pieces.length - 1 ? line.end : line.start + Math.round((duration * before) / total);
    return { start, end, text };
  });
}

/** Characters that are spoken (no spaces or punctuation). */
function spoken(text: string): number {
  return text.replace(/[\s\p{P}\p{S}]/gu, '').length;
}

/** Joins two pieces; a space only between Latin words. */
function joinJa(a: string, b: string): string {
  return /[A-Za-z0-9]$/.test(a) && /^[A-Za-z0-9]/.test(b) ? `${a} ${b}` : `${a}${b}`;
}

function normalise(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LONG_REPEAT, (_all, unit: string) => unit.repeat(3));
}
