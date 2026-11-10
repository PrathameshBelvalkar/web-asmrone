import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioInput, TimedLine } from '../../src/models/ai-subtitles.js';
import { makeTrack, type Track } from '../../src/models/echo/media.js';
import { serverMedia } from '../../src/models/echo/streamable.js';
import { feedOfPaged } from '../../src/models/feed.js';
import { PagedData } from '../../src/models/paged-data.js';
import { AiSubtitleRepository } from '../../src/repositories/ai-subtitle.repository.js';
import { AiSubtitleService } from '../../src/services/ai-subtitles/ai-subtitle.service.js';
import { ffmpegArgs, type AudioStream } from '../../src/services/ai-subtitles/audio-stream.js';
import {
  addInterval,
  firstUncovered,
  planNextPiece,
  type PlanInput,
} from '../../src/services/ai-subtitles/chunk-planner.js';
import { cleanTranscript } from '../../src/services/ai-subtitles/cleanup.js';
import { LiveTranscriber } from '../../src/services/ai-subtitles/live-transcriber.js';
import {
  bytesToMs,
  msToBytes,
  quietestPoint,
  wavFromPcm,
} from '../../src/services/ai-subtitles/pcm.js';
import type { SpeechEngine } from '../../src/services/ai-subtitles/whisper-server.js';
import type { FeedService } from '../../src/services/feed.service.js';
import { MediaService } from '../../src/services/media.service.js';
import { createFakeExtension } from '../helpers/fake-extension.js';
import { tempDir } from '../helpers/tmp.js';

const line = (start: number, end: number, text: string): TimedLine => ({ start, end, text });

/** A loud tone with silent stretches, as 16 kHz mono PCM. */
function pcm(totalMs: number, silences: readonly [number, number][] = []): Buffer {
  const samples = msToBytes(totalMs) / 2;
  const buf = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const ms = i / 16;
    const silent = silences.some(([a, b]) => ms >= a && ms < b);
    buf.writeInt16LE(silent ? 0 : Math.round(8000 * Math.sin(i / 5)), i * 2);
  }
  return buf;
}

/** Audio that "arrives" as the test says, read from an in-memory buffer. */
class FakeAudio implements AudioStream {
  /** Label of the stream read most recently. */
  static lastRead = '';
  available = 0;
  done = false;
  failure: Error | null = null;
  closed = false;
  constructor(
    private readonly data: Buffer,
    private readonly label = '',
  ) {}
  arriveAll(): void {
    this.available = bytesToMs(this.data.length);
    this.done = true;
  }
  availableMs(): number {
    return this.available;
  }
  isDone(): boolean {
    return this.done;
  }
  error(): Error | null {
    return this.failure;
  }
  read(startMs: number, endMs: number): Promise<Buffer> {
    FakeAudio.lastRead = this.label;
    const end = Math.min(msToBytes(endMs), msToBytes(this.available));
    return Promise.resolve(this.data.subarray(Math.min(msToBytes(startMs), end), end));
  }
  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

/** Returns one line per piece, spanning it, and records the pieces' lengths. */
function fakeEngine(): SpeechEngine & { pieces: number[] } {
  const pieces: number[] = [];
  return {
    pieces,
    unavailableReason: () => Promise.resolve(null),
    transcribe: (data) => {
      pieces.push(bytesToMs(data.length));
      return Promise.resolve([line(0, bytesToMs(data.length), `piece${pieces.length}`)]);
    },
    close: () => Promise.resolve(),
  };
}

describe('cleanTranscript', () => {
  it('drops filler phrases, symbol-only lines and bracketed sound labels', () => {
    const out = cleanTranscript([
      line(0, 1000, 'ご視聴ありがとうございました'),
      line(1000, 2000, '♪'),
      line(2000, 3000, '(音楽)'),
      line(3000, 4000, '【拍手】'),
      line(4000, 5000, 'おかえりなさい'),
      line(5000, 6000, '  '),
    ]);
    expect(out).toEqual([line(4000, 5000, 'おかえりなさい')]);
  });

  it('merges two identical lines and drops longer loops', () => {
    const out = cleanTranscript([
      line(0, 1000, 'はい'),
      line(1000, 2000, 'はい'),
      line(2000, 3000, 'はい'),
      line(3000, 4000, 'はい'),
      line(4000, 5000, 'いい子'),
    ]);
    expect(out).toEqual([line(0, 2000, 'はい'), line(4000, 5000, 'いい子')]);
  });

  it('shortens runaway repetition inside a line and sorts by time', () => {
    const out = cleanTranscript([
      line(5000, 6000, 'b'),
      line(0, 1000, 'あっあっあっあっあっあっあっあっ'),
    ]);
    expect(out.map((l) => l.text)).toEqual(['あっあっあっ', 'b']);
  });
});

describe('pcm helpers', () => {
  it('wraps PCM in a 16 kHz mono WAV header', () => {
    const wav = wavFromPcm(Buffer.alloc(320));
    expect(wav.length).toBe(364);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt32LE(24)).toBe(16000);
    expect(wav.readUInt32LE(40)).toBe(320);
  });

  it('finds the quietest moment', () => {
    const data = pcm(4000, [[2500, 2900]]);
    const point = quietestPoint(data, 10_000);
    expect(point).toBeGreaterThanOrEqual(12_500);
    expect(point).toBeLessThanOrEqual(12_900);
  });
});

describe('ffmpegArgs', () => {
  it('decodes a whole file to raw PCM on stdout, reconnecting on network drops', () => {
    const args = ffmpegArgs({
      url: 'https://cdn/a.mp3',
      headers: {},
      startSec: null,
      endSec: null,
    });
    expect(args).not.toContain('-ss');
    expect(args).not.toContain('-headers');
    expect(args).toEqual(expect.arrayContaining(['-reconnect', '1']));
    expect(args.slice(-12)).toEqual([
      '-i',
      'https://cdn/a.mp3',
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-f',
      's16le',
      '-c:a',
      'pcm_s16le',
      'pipe:1',
    ]);
  });

  it('seeks to a chapter and sends headers', () => {
    const input: AudioInput = {
      url: 'https://x/p.m3u8',
      headers: { Referer: 'https://site/' },
      startSec: 60,
      endSec: 90,
    };
    const args = ffmpegArgs(input);
    expect(args).toEqual(
      expect.arrayContaining(['-headers', 'Referer: https://site/\r\n', '-ss', '60', '-t', '30']),
    );
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
  });
});

describe('chunk planner', () => {
  it('merges ranges and finds the first uncovered moment', () => {
    const list = addInterval(addInterval([{ start: 20, end: 30 }], { start: 0, end: 10 }), {
      start: 10,
      end: 20,
    });
    expect(list).toEqual([{ start: 0, end: 30 }]);
    expect(
      firstUncovered(
        [
          { start: 0, end: 30 },
          { start: 40, end: 50 },
        ],
        5,
      ),
    ).toBe(30);
    expect(firstUncovered([{ start: 0, end: 30 }], 35)).toBe(35);
  });

  /** Quiet moments are at every 1000 ms + 500 within the asked range, the first one. */
  const base = (over: Partial<PlanInput>): PlanInput => ({
    covered: [],
    focusMs: 0,
    availableMs: 0,
    done: false,
    quietPoint: (from) => Promise.resolve(from + 500),
    ...over,
  });

  it('waits until enough audio has arrived', async () => {
    expect(await planNextPiece(base({ availableMs: 10_000 }))).toEqual({ kind: 'wait' });
  });

  it('makes a short first piece (8–12 s) while the listener has no lines yet', async () => {
    expect(await planNextPiece(base({ availableMs: 60_000 }))).toEqual({
      kind: 'piece',
      piece: { start: 0, end: 8_500 },
    });
  });

  it('cuts later pieces at a quiet moment between 18 and 28 s', async () => {
    const plan = await planNextPiece(
      base({ availableMs: 60_000, covered: [{ start: 0, end: 8_500 }] }),
    );
    expect(plan).toEqual({ kind: 'piece', piece: { start: 8_500, end: 8_500 + 18_500 } });
  });

  it('starts at the listening position, just before it at a quiet moment', async () => {
    const plan = await planNextPiece(
      base({ availableMs: 600_000, focusMs: 300_000, covered: [{ start: 0, end: 20_000 }] }),
    );
    expect(plan).toEqual({ kind: 'piece', piece: { start: 297_500, end: 297_500 + 8_500 } });
  });

  it('fills a small gap before the listening position instead of skipping it', async () => {
    const plan = await planNextPiece(
      base({ availableMs: 600_000, focusMs: 25_000, covered: [{ start: 0, end: 20_000 }] }),
    );
    expect(plan).toEqual({ kind: 'piece', piece: { start: 20_000, end: 28_500 } });
  });

  it('works on the beginning while the listening position has not downloaded yet', async () => {
    const plan = await planNextPiece(
      base({ availableMs: 60_000, focusMs: 300_000, covered: [{ start: 0, end: 20_000 }] }),
    );
    expect(plan).toEqual({ kind: 'piece', piece: { start: 20_000, end: 38_500 } });
  });

  it('ends exactly at the next covered range or the end of the track', async () => {
    const before = await planNextPiece(
      base({
        availableMs: 100_000,
        covered: [
          { start: 0, end: 20_000 },
          { start: 40_000, end: 60_000 },
        ],
      }),
    );
    expect(before).toEqual({ kind: 'piece', piece: { start: 20_000, end: 40_000 } });
    const last = await planNextPiece(
      base({ availableMs: 70_000, done: true, covered: [{ start: 0, end: 60_000 }] }),
    );
    expect(last).toEqual({ kind: 'piece', piece: { start: 60_000, end: 70_000 } });
  });

  it('is complete when everything is covered', async () => {
    expect(
      await planNextPiece(
        base({ availableMs: 70_000, done: true, covered: [{ start: 0, end: 70_000 }] }),
      ),
    ).toEqual({ kind: 'complete' });
  });
});

describe('LiveTranscriber', () => {
  it('transcribes pieces as audio arrives, shifts their times, and saves at the end', async () => {
    // Quiet at 10 s (the short first cut) and 30 s (the next one).
    const audio = new FakeAudio(
      pcm(45_000, [
        [10_000, 10_400],
        [30_000, 30_400],
      ]),
    );
    const engine = fakeEngine();
    const saved = vi.fn((_key: string, _lines: readonly TimedLine[]) => Promise.resolve());
    const live = new LiveTranscriber<null>({
      engine,
      openAudio: () => Promise.resolve(audio),
      save: saved,
      expectedMs: () => 45_000,
      idleMs: 5,
    });

    live.request('t', null, null);
    await vi.waitFor(() => {
      expect(live.status('t')).toMatchObject({ status: 'running', phase: 'starting' });
    });
    audio.available = 30_000; // the first 30 s arrive
    await vi.waitFor(() => {
      expect(engine.pieces).toHaveLength(1);
    });
    const running = live.status('t');
    expect(running).toMatchObject({ status: 'running', phase: 'transcribing', totalMs: 45_000 });
    expect(running?.status === 'running' && running.covered[0]?.end).toBe(10_150);

    audio.arriveAll();
    await live.idle();
    expect(saved).toHaveBeenCalledTimes(1);
    const lines = saved.mock.calls[0]?.[1] ?? [];
    expect(lines.map((l) => [l.start, l.end, l.text])).toEqual([
      [0, 10_150, 'piece1'],
      [10_150, 30_160, 'piece2'],
      [30_160, 45_000, 'piece3'],
    ]);
    expect(audio.closed).toBe(true);
    expect(live.status('t')).toBeNull();
  });

  it('works on the most recently asked-for track first', async () => {
    const a = new FakeAudio(pcm(10_000), 'a');
    const b = new FakeAudio(pcm(10_000), 'b');
    const order: string[] = [];
    const engine: SpeechEngine = {
      unavailableReason: () => Promise.resolve(null),
      transcribe: (data) => {
        order.push(data.length > 0 ? FakeAudio.lastRead : '?');
        return Promise.resolve([]);
      },
      close: () => Promise.resolve(),
    };
    const audios: Record<string, FakeAudio> = { a, b };
    const live = new LiveTranscriber<string>({
      engine,
      openAudio: (key) => Promise.resolve(audios[key] as AudioStream),
      save: () => Promise.resolve(),
      expectedMs: () => null,
      idleMs: 5,
    });
    live.request('a', 'a', null);
    live.request('b', 'b', null);
    await vi.waitFor(() => {
      expect(live.status('b')).toMatchObject({ status: 'running' });
    });
    a.arriveAll();
    b.arriveAll();
    await live.idle();
    expect(order).toEqual(['b', 'a']);
  });

  it('fails a track whose audio cannot be read, and does not retry it straight away', async () => {
    const audio = new FakeAudio(Buffer.alloc(0));
    audio.failure = new Error('Audio download exited with code 1: 404');
    audio.done = true;
    const openAudio = vi.fn(() => Promise.resolve(audio));
    const live = new LiveTranscriber<null>({
      engine: fakeEngine(),
      openAudio,
      save: () => Promise.resolve(),
      expectedMs: () => null,
      idleMs: 5,
    });
    live.request('t', null, null);
    await live.idle();
    expect(live.status('t')).toEqual({
      status: 'failed',
      message: 'Audio download exited with code 1: 404',
      lines: [],
    });
    live.request('t', null, null);
    expect(openAudio).toHaveBeenCalledTimes(1);
  });
});

describe('AiSubtitleService', () => {
  let dir = '';
  let cleanup: () => Promise<void> = () => Promise.resolve();

  beforeEach(async () => {
    const t = await tempDir();
    dir = t.dir;
    cleanup = t.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  function setup(reason: string | null = null) {
    const audio = new FakeAudio(pcm(10_000));
    const inputs: AudioInput[] = [];
    const engine = { ...fakeEngine(), unavailableReason: () => Promise.resolve(reason) };
    const translate = vi.fn((texts: readonly string[]) =>
      Promise.resolve(texts.map((t) => `EN:${t}`)),
    );
    const repository = new AiSubtitleRepository(dir);
    const service = new AiSubtitleService({
      extension: { loadStreamableMedia: () => Promise.resolve(serverMedia('https://cdn/a.mp3')) },
      engine,
      openAudio: (input) => {
        inputs.push(input);
        return Promise.resolve(audio);
      },
      repository,
      translator: { languageCode: () => 'en', translate },
      enabled: () => true,
      live: { idleMs: 5 },
    });
    return { service, repository, translate, inputs, audio };
  }

  const track: Track = makeTrack({
    id: 'RJ1-a',
    title: 'A',
    duration: 10_000,
    streamables: [{ id: 'https://cdn/a.mp3', quality: 1, type: 'Server', title: null, extras: {} }],
  });

  it('reports progress while running, then serves the saved, translated result', async () => {
    const s = setup();
    const first = await s.service.get(track, 0);
    expect(first.extras).toMatchObject({
      aiGenerated: 'true',
      aiStatus: 'running',
      aiTotalMs: '10000',
      aiProgress: '0',
    });
    expect(first.lyrics).toBeNull();

    s.audio.arriveAll();
    await s.service.idle();
    expect(await s.repository.get(track.id)).toEqual([line(0, 10_000, 'piece1')]);
    const done = await s.service.get(track, 0);
    expect(done.extras.aiStatus).toBe('done');
    expect(done.lyrics).toEqual({
      kind: 'Timed',
      fillTimeGaps: true,
      list: [{ text: 'EN:piece1', startTime: 0, endTime: 10_000 }],
    });
    expect(s.inputs).toEqual([
      { url: 'https://cdn/a.mp3', headers: {}, startSec: null, endSec: null },
    ]);
  });

  it('prefers the low-quality copy and passes the chapter range', async () => {
    const s = setup();
    const chapter = makeTrack({
      ...track,
      id: 'jasmr:1#2',
      extras: { start: '120', end: '300.5', lowQualityStreamUrl: 'https://cdn/a-low.mp3' },
    });
    await s.service.get(chapter, null);
    await vi.waitFor(() => {
      expect(s.inputs).toHaveLength(1);
    });
    expect(s.inputs[0]).toEqual({
      url: 'https://cdn/a-low.mp3',
      headers: {},
      startSec: 120,
      endSec: 300.5,
    });
    s.audio.arriveAll();
    await s.service.idle();
  });

  it('reports why it is unavailable without starting', async () => {
    const s = setup('whisper-server was not found.');
    const res = await s.service.get(track);
    expect(res.lyrics).toBeNull();
    expect(res.extras).toMatchObject({
      aiStatus: 'unavailable',
      aiMessage: 'whisper-server was not found.',
    });
    expect(s.inputs).toHaveLength(0);
  });
});

describe('MediaService.lyrics with AI subtitles', () => {
  const track: Track = makeTrack({ id: 'RJ1-a', title: 'A' });
  const realLyrics = {
    id: 'a.vtt',
    title: 'A',
    subtitle: null,
    lyrics: null,
    extras: { workId: 'RJ1' },
  };
  const aiLyrics = {
    id: 'ai:RJ1-a',
    title: 'A',
    subtitle: 'AI generated',
    lyrics: null,
    extras: { aiStatus: 'running' },
  };

  function setup(found: boolean, enabled: boolean) {
    const ext = createFakeExtension();
    ext.searchTrackLyrics.mockResolvedValue(
      feedOfPaged(PagedData.single(() => Promise.resolve(found ? [realLyrics] : []))),
    );
    ext.loadLyrics.mockImplementation((l) => Promise.resolve(l));
    const ai = { isEnabled: () => enabled, get: vi.fn(() => Promise.resolve(aiLyrics)) };
    const media = new MediaService(ext, {} as FeedService, ai as unknown as AiSubtitleService);
    return { media, ai };
  }

  it('prefers the work’s own subtitle file', async () => {
    const { media, ai } = setup(true, true);
    expect(await media.lyrics(track)).toEqual(realLyrics);
    expect(ai.get).not.toHaveBeenCalled();
  });

  it('falls back to AI subtitles when there is no file, passing the position', async () => {
    const { media, ai } = setup(false, true);
    expect(await media.lyrics(track, 61_000)).toEqual(aiLyrics);
    expect(ai.get).toHaveBeenCalledWith(track, 61_000);
  });

  it('returns null when the setting is off', async () => {
    const { media, ai } = setup(false, false);
    expect(await media.lyrics(track)).toBeNull();
    expect(ai.get).not.toHaveBeenCalled();
  });
});
