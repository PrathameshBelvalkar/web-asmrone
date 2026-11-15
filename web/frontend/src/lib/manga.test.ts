import { beforeEach, describe, expect, it } from 'vitest';
import {
  autoRtl,
  buildSpreads,
  formatCount,
  lastLanguage,
  loadPrefs,
  readerAction,
  resumePage,
  saveLastLanguage,
  saveResume,
  spreadIndexOf,
} from './manga';

const tall = { width: 900, height: 1300 };
const wide = { width: 1800, height: 1300 };
const pages = (...list: { width: number; height: number }[]) => list;

describe('reader spreads', () => {
  it('shows one page at a time in single page and long strip', () => {
    expect(buildSpreads(pages(tall, tall, tall), 'single', true)).toEqual([[1], [2], [3]]);
    expect(buildSpreads(pages(tall, tall), 'strip', true)).toEqual([[1], [2]]);
  });

  it('keeps the cover alone and pairs the rest in two-page mode', () => {
    expect(buildSpreads(pages(tall, tall, tall, tall, tall), 'double', true)).toEqual([[1], [2, 3], [4, 5]]);
    expect(buildSpreads(pages(tall, tall, tall, tall), 'double', true)).toEqual([[1], [2, 3], [4]]);
  });

  it('pairs from the first page when the cover is not alone (the offset switch)', () => {
    expect(buildSpreads(pages(tall, tall, tall, tall, tall), 'double', false)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('shows a wide page (a scanned spread) alone, and the page before it alone too', () => {
    expect(buildSpreads(pages(tall, tall, wide, tall, tall), 'double', true)).toEqual([[1], [2], [3], [4, 5]]);
    expect(buildSpreads(pages(tall, tall, tall, wide), 'double', true)).toEqual([[1], [2, 3], [4]]);
  });

  it('finds the spread of a page, clamping pages outside the gallery', () => {
    const spreads = [[1], [2, 3], [4, 5]];
    expect(spreadIndexOf(spreads, 3)).toBe(1);
    expect(spreadIndexOf(spreads, 0)).toBe(0);
    expect(spreadIndexOf(spreads, 99)).toBe(2);
  });
});

describe('reading direction', () => {
  it('reads right to left unless the gallery is a Western comic', () => {
    expect(autoRtl([{ kind: 'category', slug: 'doujinshi' }, { kind: 'language', slug: 'english' }])).toBe(true);
    expect(autoRtl([{ kind: 'category', slug: 'manga' }])).toBe(true);
    expect(autoRtl([{ kind: 'category', slug: 'western' }])).toBe(false);
  });

  it('turns an old right-to-left switch into a direction', () => {
    localStorage.setItem('echo:manga:reader', JSON.stringify({ mode: 'double', fit: 'width', rtl: true }));
    expect(loadPrefs()).toMatchObject({ mode: 'double', fit: 'width', direction: 'rtl', coverAlone: true });
    expect(loadPrefs()).not.toHaveProperty('rtl');
    localStorage.clear();
    expect(loadPrefs().direction).toBe('auto');
  });
});

describe('reader keys', () => {
  it('turns pages with the arrows, A/D and Page Up/Down; right is always next', () => {
    expect(readerAction('ArrowRight')).toBe('next');
    expect(readerAction('d')).toBe('next');
    expect(readerAction('ArrowLeft')).toBe('prev');
    expect(readerAction('PageDown')).toBe('next');
    expect(readerAction('PageUp')).toBe('prev');
  });

  it('maps the other shortcuts and ignores everything else', () => {
    expect(readerAction('Home')).toBe('first');
    expect(readerAction('End')).toBe('last');
    expect(readerAction('f')).toBe('fullscreen');
    expect(readerAction('M')).toBe('mode');
    expect(readerAction('t')).toBe('thumbs');
    expect(readerAction('s')).toBe('settings');
    expect(readerAction('Escape')).toBe('close');
    expect(readerAction('x')).toBeNull();
  });
});

describe('reading position', () => {
  beforeEach(() => localStorage.clear());

  it('remembers the last page per gallery, but not page 1', () => {
    expect(resumePage('7')).toBeNull();
    saveResume('7', 12);
    expect(resumePage('7')).toBe(12);
    saveResume('7', 1);
    expect(resumePage('7')).toBeNull();
  });

  it('copes with broken stored data', () => {
    localStorage.setItem('echo:manga:resume', '{not json');
    expect(resumePage('7')).toBeNull();
    saveResume('7', 3);
    expect(resumePage('7')).toBe(3);
  });
});

describe('Browse language', () => {
  beforeEach(() => localStorage.clear());

  it('remembers the last language, and forgets it for all languages', () => {
    expect(lastLanguage()).toBeNull();
    saveLastLanguage('english');
    expect(lastLanguage()).toBe('english');
    saveLastLanguage(null);
    expect(lastLanguage()).toBeNull();
  });

  it('ignores a stored value that is not a known language', () => {
    localStorage.setItem('echo:manga:language', 'klingon');
    expect(lastLanguage()).toBeNull();
  });
});

it('formats counts', () => {
  expect(formatCount(21000)).toBe('21K');
  expect(formatCount(1_250_000)).toBe('1.3M');
  expect(formatCount(950)).toBe('950');
  expect(formatCount(null)).toBe('');
});
