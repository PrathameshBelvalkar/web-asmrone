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

/**
 * Removes typical Whisper mistakes from a transcript: filler phrases, symbol-only and bracketed
 * sound labels, runaway repetition inside a line, and loops of the same line. Keeps time order.
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
  return out;
}

function normalise(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LONG_REPEAT, (_all, unit: string) => unit.repeat(3));
}
