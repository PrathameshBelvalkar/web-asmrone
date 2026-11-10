/** One transcribed line. Times are milliseconds from the start of the track (or chapter). */
export interface TimedLine {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** Where to read a track's audio: a URL (file or HLS playlist), headers, and an optional chapter range. */
export interface AudioInput {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  /** Chapter start in seconds, or null for the whole file. */
  readonly startSec: number | null;
  /** Chapter end in seconds, or null to read to the end. */
  readonly endSec: number | null;
}
