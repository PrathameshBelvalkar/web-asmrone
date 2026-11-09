import { describe, expect, it } from 'vitest';
import { parseLrc, parseTimeToMillis, parseWebVtt } from '../../src/extension/asmrone/lyrics/parse.js';
import {
  applyTranslations,
  deepCopy,
  findFile,
  findMainAudioFolder,
  getAllAudioFiles,
  getAllTitles,
  getFolder,
  folder,
  type AudioNode,
  type FolderNode,
} from '../../src/extension/asmrone/media-tree/tree.js';

function audio(title: string, hash = title): AudioNode {
  return {
    type: 'audio',
    title,
    untranslatedTitle: title,
    hash,
    work: { id: 1, source_id: 's', source_type: 't' },
    workTitle: 'w',
    mediaStreamUrl: `https://cdn/${hash}`,
    mediaDownloadUrl: `https://cdn/dl/${hash}`,
    streamLowQualityUrl: null,
    duration: 1,
    size: 1,
    ...{},
  };
}

describe('LRC parsing', () => {
  it('gives every timestamp on a line the same text and chains end times', () => {
    const lines = parseLrc('[00:01.00][00:03.50]Hello\n[00:05.00]World\n');
    expect(lines).toEqual([
      { text: 'Hello', startTime: 1000, endTime: 3500 },
      { text: 'Hello', startTime: 3500, endTime: 5000 },
      { text: 'World', startTime: 5000, endTime: 10000 },
    ]);
  });

  it('skips lines with no text and keeps leading spaces after the timestamp', () => {
    expect(parseLrc('[00:01.00]\n[00:02.00]  spaced')).toEqual([
      { text: '  spaced', startTime: 2000, endTime: 7000 },
    ]);
  });
});

describe('WebVTT parsing', () => {
  it('parses cues and ignores the WEBVTT header and index lines', () => {
    const vtt = 'WEBVTT\n\n1\n00:01.000 --> 00:03.000\nHello\nthere\n\n2\n00:04.000 --> 00:06.000\nBye\n';
    expect(parseWebVtt(vtt)).toEqual([
      { text: 'Hello\nthere', startTime: 1000, endTime: 3000 },
      { text: 'Bye', startTime: 4000, endTime: 6000 },
    ]);
  });

  it('ignores cue settings after the end time (Kotlin crashed on these)', () => {
    const vtt = 'WEBVTT\n\n00:01.000 --> 00:02.500 align:start position:10%\nLine\n';
    expect(parseWebVtt(vtt)).toEqual([{ text: 'Line', startTime: 1000, endTime: 2500 }]);
  });
});

describe('parseTimeToMillis', () => {
  it('reads MM:SS.mmm and HH:MM:SS.mmm, padding short millisecond parts', () => {
    expect(parseTimeToMillis('01:02.5')).toBe(62_500);
    expect(parseTimeToMillis('01:00:02.123')).toBe(3_602_123);
    expect(parseTimeToMillis('00:02')).toBe(2000);
  });

  it('rejects malformed times', () => {
    expect(() => parseTimeToMillis('12')).toThrow();
    expect(() => parseTimeToMillis('a:b')).toThrow();
  });
});

describe('media tree', () => {
  const tree: FolderNode = folder('root', [
    folder('Disc', [audio('intro.wav', 'h1'), folder('mp3', [audio('a.mp3', 'h2'), audio('b.mp3', 'h3')])]),
    folder('extras', [folder('deep', [folder('deeper', [audio('z.wav', 'h4')])])]),
  ]);

  it('finds the "mp3" folder as the main audio folder', () => {
    expect(findMainAudioFolder(tree)).toBe('Disc/mp3');
  });

  it('falls back to the folder with the most audio when there is no mp3 folder', () => {
    const noMp3 = folder('root', [folder('x', [audio('one.wav', 'q1')])]);
    expect(findMainAudioFolder(noMp3)).toBe('x');
  });

  it('getFolder stops at the last valid ancestor', () => {
    expect(getFolder(tree, 'Disc/missing/deeper').title).toBe('Disc');
    expect(getFolder(tree, '').title).toBe('root');
  });

  it('recursive audio listing returns each file once, including deep ones', () => {
    const titles = getAllAudioFiles(tree, true).map((a) => a.title).sort();
    expect(titles).toEqual(['a.mp3', 'b.mp3', 'intro.wav', 'z.wav']);
  });

  it('findFile matches translated or original titles, depth first', () => {
    expect(findFile(tree, 'z.wav')?.type).toBe('audio');
    expect(findFile(tree, 'nope')).toBeNull();
  });

  it('applyTranslations rewrites audio and folder titles only', () => {
    const copy = deepCopy(tree);
    applyTranslations(copy, new Map([['intro.wav', 'Intro'], ['Disc', 'Disk']]));
    expect(getAllTitles(copy)).toContain('Intro');
    expect(getAllTitles(copy)).toContain('Disk');
    expect(getAllTitles(tree)).toContain('intro.wav');
  });

  it('deepCopy keeps the untranslated title of folders', () => {
    const node = folder('Original', []);
    const translated: FolderNode = { ...node, title: 'Translated' };
    expect(deepCopy(translated).untranslatedTitle).toBe('Original');
  });
});
