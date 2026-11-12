import { appLogger } from '../../lib/app-logger.js';
import { LruCache } from '../../lib/lru-cache.js';
import type { AudioInput, TimedLine } from '../../models/ai-subtitles.js';
import type { Lyric, Lyrics } from '../../models/echo/lyrics.js';
import { serversOf, type Track } from '../../models/echo/media.js';
import type { MusicExtension } from '../../models/extension.js';
import type { AiSubtitleRepository } from '../../repositories/ai-subtitle.repository.js';
import type { AudioStream } from './audio-stream.js';
import { cleanTranscript } from './cleanup.js';
import { LiveTranscriber, type LiveDeps } from './live-transcriber.js';
import type { SpeechEngine } from './whisper-server.js';

/** Translates subtitle lines into the user's language. */
export interface SubtitleTranslator {
  /** The current target language; part of the translation cache key. */
  languageCode(): string;
  /** Translations in the same order, or null when translation failed (originals are shown). */
  translate(texts: readonly string[]): Promise<readonly string[] | null>;
}

export interface AiSubtitleDeps {
  readonly extension: Pick<MusicExtension, 'loadStreamableMedia'>;
  readonly engine: SpeechEngine;
  /** Starts decoding a track's audio. */
  readonly openAudio: (input: AudioInput) => Promise<AudioStream>;
  readonly repository: AiSubtitleRepository;
  readonly translator: SubtitleTranslator;
  /** The "Auto-generate AI subtitles" setting. */
  readonly enabled: () => boolean;
  /** Scheduler tuning (tests). */
  readonly live?: Partial<Pick<LiveDeps<Track>, 'maxJobs' | 'retryAfterMs' | 'idleMs' | 'now'>>;
}

/** `extras.aiStatus` on the returned lyrics. */
export type AiStatus = 'running' | 'done' | 'failed' | 'unavailable';

/** How long a missing-program or missing-model check is trusted before it is run again. */
const AVAILABILITY_TTL_MS = 30_000;

/**
 * Subtitles made on this machine with Whisper for tracks that have none. Asking for a track starts
 * transcribing it piece by piece while its audio downloads, beginning at the listening position.
 * Until it is finished, the lines so far are returned with progress in `extras`, and the client
 * polls (sending its position). Finished subtitles are saved to disk.
 */
export class AiSubtitleService {
  private readonly live: LiveTranscriber<Track>;
  private readonly translations = new LruCache<string, string>(20_000);
  private availability: { reason: string | null; at: number } | null = null;

  constructor(private readonly deps: AiSubtitleDeps) {
    this.live = new LiveTranscriber<Track>({
      ...deps.live,
      engine: deps.engine,
      openAudio: async (track) => deps.openAudio(await this.audioInput(track)),
      save: async (key, lines) => {
        const cleaned = cleanTranscript(lines);
        await deps.repository.put(key, cleaned);
        appLogger().info({ trackId: key, lines: cleaned.length }, 'AI subtitles saved');
      },
      expectedMs: expectedLength,
    });
  }

  isEnabled(): boolean {
    return this.deps.enabled();
  }

  /**
   * AI subtitles for a track: finished, in progress, or the reason they can't be made.
   * `positionMs` is where the listener is; transcription starts there.
   */
  async get(track: Track, positionMs: number | null = null): Promise<Lyrics> {
    const saved = await this.deps.repository.get(track.id);
    // Cleaned again so subtitles saved by an older version get the current rules (e.g. line splitting).
    if (saved) return this.toLyrics(track, 'done', cleanTranscript(saved), {});

    const reason = await this.unavailableReason();
    if (reason !== null) return this.toLyrics(track, 'unavailable', [], { aiMessage: reason });

    this.live.request(track.id, track, positionMs);
    const job = this.live.status(track.id);
    if (job === null) {
      // Finished between the disk read and the request; otherwise report it as starting (never as
      // "done" without a saved result, which the client would keep as "no speech").
      const done = await this.deps.repository.get(track.id);
      if (done) return this.toLyrics(track, 'done', cleanTranscript(done), {});
      return this.toLyrics(track, 'running', [], {
        aiPhase: 'starting',
        aiCoveredMs: '0',
        aiCovered: '',
      });
    }
    if (job.status === 'failed') {
      return this.toLyrics(track, 'failed', cleanTranscript(job.lines), { aiMessage: job.message });
    }
    const extras: Record<string, string> = {
      aiPhase: job.phase,
      aiCoveredMs: String(job.coveredMs),
      aiCovered: job.covered.map((iv) => `${iv.start}-${iv.end}`).join(','),
    };
    if (job.totalMs !== null && job.totalMs > 0) {
      extras.aiTotalMs = String(job.totalMs);
      extras.aiProgress = String(Math.min(99, Math.floor((job.coveredMs / job.totalMs) * 100)));
    }
    return this.toLyrics(track, 'running', cleanTranscript(job.lines), extras);
  }

  /** Resolves when no transcription is in progress (used by tests). */
  idle(): Promise<void> {
    return this.live.idle();
  }

  async close(): Promise<void> {
    await this.live.close();
    await this.deps.engine.close();
  }

  /** Forgets the cached "is it ready?" answer so a change in setup takes effect at once. */
  resetAvailability(): void {
    this.availability = null;
  }

  /**
   * The audio to transcribe: a smaller low-quality copy when the source offers one (plenty for
   * speech, and much faster to download), and the chapter range when the track is part of a longer file.
   */
  private async audioInput(track: Track): Promise<AudioInput> {
    const range = { startSec: seconds(track.extras.start), endSec: seconds(track.extras.end) };
    const lowQuality = track.extras.lowQualityStreamUrl;
    if (lowQuality) return { url: lowQuality, headers: {}, ...range };

    const server = serversOf(track)[0];
    if (!server) throw new Error('This track has no stream');
    const media = await this.deps.extension.loadStreamableMedia(server);
    const source = media.mediaKind === 'Server' ? media.sources[0] : undefined;
    if (!source) throw new Error('This track has no playable source');
    return { url: source.request.url, headers: source.request.headers, ...range };
  }

  private async unavailableReason(): Promise<string | null> {
    const now = Date.now();
    if (this.availability && now - this.availability.at < AVAILABILITY_TTL_MS)
      return this.availability.reason;
    const reason = await this.deps.engine.unavailableReason();
    this.availability = { reason, at: now };
    return reason;
  }

  private async toLyrics(
    track: Track,
    status: AiStatus,
    lines: readonly TimedLine[],
    extras: Record<string, string>,
  ): Promise<Lyrics> {
    return {
      id: `ai:${track.id}`,
      title: track.title,
      subtitle: 'AI generated',
      lyrics: lines.length > 0 ? await this.translated(lines) : null,
      extras: { ...extras, aiGenerated: 'true', aiStatus: status },
    };
  }

  /** Translates only lines not seen before, so polling an in-progress track stays cheap. */
  private async translated(lines: readonly TimedLine[]): Promise<Lyric> {
    const language = this.deps.translator.languageCode();
    const key = (text: string): string => `${language}\u0000${text}`;
    const missing = [
      ...new Set(lines.map((l) => l.text).filter((text) => !this.translations.has(key(text)))),
    ];
    if (missing.length > 0) {
      const result = await this.deps.translator.translate(missing);
      if (result) {
        missing.forEach((text, i) => {
          this.translations.set(key(text), result[i] ?? text);
        });
      }
    }
    const list = lines.map((l) => ({
      text: this.translations.get(key(l.text)) ?? l.text,
      startTime: l.start,
      endTime: l.end,
    }));
    return { kind: 'Timed', list, fillTimeGaps: true };
  }
}

/** Track length in ms from metadata: the chapter range, or the track's duration. */
function expectedLength(track: Track): number | null {
  const start = seconds(track.extras.start);
  const end = seconds(track.extras.end);
  if (end !== null) return Math.max(0, (end - (start ?? 0)) * 1000);
  return track.duration !== null && track.duration > 0 ? track.duration : null;
}

function seconds(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
