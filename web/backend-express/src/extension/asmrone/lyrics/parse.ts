import type { Lyric, LyricLine } from '../../../models/echo/lyrics.js';
import { translateList } from '../translation/translate-list.js';
import { moveFirstGroupToEnd } from '../translation/title.js';
import type { TranslationLanguage } from '../languages.js';

const LRC_TIMESTAMP = /\[(\d{2}):(\d{2})\.(\d{2})]/g;

/** Parses LRC or WebVTT text into timed lyrics, then translates the lines. */
export async function toTimedLyrics(text: string, language: TranslationLanguage): Promise<Lyric> {
  const isLrc = text.trimStart().startsWith('[') && /\[\d{2}:\d{2}\.\d{2}]/.test(text);
  const lines = isLrc ? parseLrc(text) : parseWebVtt(text);
  return translateTimed(lines, language);
}

/** LRC: one or more leading timestamps per line; each timestamp gets the same text. */
export function parseLrc(text: string): LyricLine[] {
  const items: { text: string; startTime: number; endTime: number }[] = [];
  for (const rawLine of splitLines(text)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const matches = [...line.matchAll(LRC_TIMESTAMP)];
    if (matches.length === 0) continue;
    const last = matches[matches.length - 1];
    const textStart = (last?.index ?? 0) + (last?.[0].length ?? 0);
    const content = textStart < line.length ? line.slice(textStart) : '';
    for (const m of matches) {
      const minutes = Number(m[1]);
      const seconds = Number(m[2]);
      const centiseconds = Number(m[3]);
      const startTime = (minutes * 60 + seconds) * 1000 + centiseconds * 10;
      if (content.length > 0) {
        items.push({ text: content, startTime, endTime: startTime + 5000 });
      }
    }
  }
  // Each line ends where the next one starts (the last keeps start + 5 s).
  for (let i = 0; i < items.length - 1; i++) {
    const current = items[i];
    const next = items[i + 1];
    if (current && next) current.endTime = next.startTime;
  }
  return items;
}

/**
 * WebVTT cues. Cue settings after the end time (e.g. "align:start") are ignored; the Kotlin
 * parser failed on them.
 */
export function parseWebVtt(text: string): LyricLine[] {
  const all = splitLines(text);
  const content = all.length > 0 && all[0]?.trim() === 'WEBVTT' ? all.slice(1) : all;
  const items: LyricLine[] = [];
  let timing: { start: number; end: number } | null = null;
  let cueText: string[] = [];

  const flush = (): void => {
    if (timing && cueText.length > 0) {
      items.push({ text: cueText.join('\n').trim(), startTime: timing.start, endTime: timing.end });
    }
    timing = null;
    cueText = [];
  };

  for (const rawLine of content) {
    const line = rawLine.trim();
    if (line.length === 0) {
      if (timing && cueText.length > 0) flush();
    } else if (line.includes('-->')) {
      timing = parseTimestamp(line);
    } else if (!/^\d+$/.test(line) && timing) {
      cueText.push(line);
    }
  }
  if (timing && cueText.length > 0) flush();
  return items;
}

function parseTimestamp(line: string): { start: number; end: number } {
  const parts = line.split('-->');
  if (parts.length !== 2) throw new Error(`Invalid timestamp format: ${line}`);
  const start = parseTimeToMillis((parts[0] ?? '').trim());
  // Keep only the time; anything after whitespace is a cue setting.
  const endToken = (parts[1] ?? '').trim().split(/\s+/)[0] ?? '';
  return { start, end: parseTimeToMillis(endToken) };
}

/** HH:MM:SS.mmm or MM:SS.mmm. Missing or short millisecond parts are padded. */
export function parseTimeToMillis(time: string): number {
  const parts = time.split(':');
  if (parts.length < 2 || parts.length > 3) throw new Error(`Invalid time format: ${time}`);
  const hours = parts.length === 3 ? toInt(parts[0] ?? '') : 0;
  const minutes = parts.length === 3 ? toInt(parts[1] ?? '') : toInt(parts[0] ?? '');
  const lastPart = parts.length === 3 ? (parts[2] ?? '') : (parts[1] ?? '');
  const [secondsText = '', millisText] = lastPart.split('.');
  const seconds = toInt(secondsText);
  const millis = millisText === undefined ? 0 : toInt(millisText.padEnd(3, '0').slice(0, 3));
  return (hours * 3600 + minutes * 60 + seconds) * 1000 + millis;
}

function toInt(text: string): number {
  if (!/^\d+$/.test(text)) throw new Error(`Invalid number in time: ${text}`);
  return Number(text);
}

function splitLines(text: string): string[] {
  return text.split(/\r\n|\n|\r/);
}

async function translateTimed(lines: readonly LyricLine[], language: TranslationLanguage): Promise<Lyric> {
  const map = await translateList(
    lines.map((l) => l.text),
    language,
  );
  const list = lines.map((l) => ({
    text: map ? (map.has(l.text) ? moveFirstGroupToEnd(map.get(l.text) ?? l.text) : l.text) : l.text,
    startTime: l.startTime,
    endTime: l.endTime,
  }));
  return { kind: 'Timed', list, fillTimeGaps: true };
}
