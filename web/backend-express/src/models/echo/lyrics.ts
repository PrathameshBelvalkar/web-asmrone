import type { Extras } from './common.js';

export interface LyricLine {
  readonly text: string;
  readonly startTime: number;
  readonly endTime: number;
}

export type Lyric =
  | { readonly kind: 'Simple'; readonly text: string }
  | { readonly kind: 'Timed'; readonly list: readonly LyricLine[]; readonly fillTimeGaps: boolean }
  | { readonly kind: 'WordByWord'; readonly list: readonly (readonly LyricLine[])[]; readonly fillTimeGaps: boolean };

export interface Lyrics {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly lyrics: Lyric | null;
  readonly extras: Extras;
}
