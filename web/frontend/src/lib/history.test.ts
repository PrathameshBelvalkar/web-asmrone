import { beforeEach, describe, expect, it } from 'vitest';
import type { MangaGallery, Track } from '../api/types';
import { MODEL_PREFIX } from '../api/types';
import { clearHistory, recordListen, recordRead, removeEntry, useHistory, workIdOf } from './history';
import { dayLabel } from '../pages/HistoryPage';

const track = (id: string, workId: string, title = `Track ${id}`) =>
  ({
    mediaItemType: `${MODEL_PREFIX}Track`,
    id,
    title,
    artists: [{ id: 'a', name: 'Circle' }],
    album: { mediaItemType: `${MODEL_PREFIX}Album`, id: workId, title: `Work ${workId}`, artists: [], cover: null, extras: {} },
    cover: null,
    extras: {},
  }) as unknown as Track;

const gallery = (id: string, pages = 20) =>
  ({ id, title: `Gallery ${id}`, prettyTitle: null, cover: 'c.jpg', coverFallbacks: [], pages: Array.from({ length: pages }), tags: [] }) as unknown as MangaGallery;

describe('history', () => {
  beforeEach(() => {
    localStorage.clear();
    clearHistory();
  });

  it('keeps one entry per work, newest first, with the last track', () => {
    recordListen(track('1', 'w1'), 1);
    recordListen(track('2', 'w2'), 2);
    recordListen(track('3', 'w1', 'Part 2'), 3);
    const entries = useHistory.getState().entries;
    expect(entries.map((e) => e.id)).toEqual(['w1', 'w2']);
    expect(entries[0]).toMatchObject({ kind: 'asmr', title: 'Work w1', trackTitle: 'Part 2', at: 3 });
  });

  it('records reading progress and persists it', () => {
    recordRead(gallery('g1'), 4, 10);
    recordRead(gallery('g1'), 7, 11);
    expect(useHistory.getState().entries).toEqual([
      expect.objectContaining({ kind: 'manga', id: 'g1', page: 7, pages: 20, at: 11 }),
    ]);
    expect(JSON.parse(localStorage.getItem('echo:history')!)).toHaveLength(1);
  });

  it('removes and clears by kind', () => {
    recordListen(track('1', 'w1'));
    recordRead(gallery('g1'), 1);
    recordRead(gallery('g2'), 1);
    removeEntry('manga', 'g1');
    expect(useHistory.getState().entries.map((e) => e.id)).toEqual(['g2', 'w1']);
    clearHistory('manga');
    expect(useHistory.getState().entries.map((e) => e.id)).toEqual(['w1']);
  });

  it('finds the work id from extras first', () => {
    expect(workIdOf({ ...track('1', 'w9'), extras: { id: 'x1' } })).toBe('x1');
    expect(workIdOf({ ...track('1', 'w9'), album: null } as Track)).toBeNull();
  });

  it('labels days', () => {
    const now = new Date(2026, 10, 15, 12).getTime();
    expect(dayLabel(new Date(2026, 10, 15, 1).getTime(), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 10, 14, 23).getTime(), now)).toBe('Yesterday');
  });
});
