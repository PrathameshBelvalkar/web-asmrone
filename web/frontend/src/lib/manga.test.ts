import { beforeEach, describe, expect, it } from 'vitest';
import { formatCount, lastLanguage, readerAction, resumePage, saveLastLanguage, saveResume, spreadAt, stepPage } from './manga';

describe('reader spreads', () => {
  it('shows one page at a time in single mode', () => {
    expect(spreadAt(3, 10, 'single')).toEqual([3]);
    expect(stepPage(3, 10, 'single', 1)).toBe(4);
    expect(stepPage(1, 10, 'single', -1)).toBe(1);
    expect(stepPage(10, 10, 'single', 1)).toBe(10);
  });

  it('keeps the cover alone and pairs the rest in double mode', () => {
    expect(spreadAt(1, 10, 'double')).toEqual([1]);
    expect(spreadAt(2, 10, 'double')).toEqual([2, 3]);
    expect(spreadAt(3, 10, 'double')).toEqual([2, 3]);
    expect(spreadAt(10, 10, 'double')).toEqual([10]);
    expect(spreadAt(9, 9, 'double')).toEqual([8, 9]);
    expect(stepPage(1, 10, 'double', 1)).toBe(2);
    expect(stepPage(2, 10, 'double', 1)).toBe(4);
    expect(stepPage(4, 10, 'double', -1)).toBe(2);
    expect(stepPage(2, 10, 'double', -1)).toBe(1);
  });

  it('clamps pages outside the gallery', () => {
    expect(spreadAt(0, 5, 'single')).toEqual([1]);
    expect(spreadAt(99, 5, 'single')).toEqual([5]);
  });
});

describe('reader keys', () => {
  it('turns pages with the arrows, A/D and Page Up/Down', () => {
    expect(readerAction('ArrowRight', false)).toBe('next');
    expect(readerAction('d', false)).toBe('next');
    expect(readerAction('ArrowLeft', false)).toBe('prev');
    expect(readerAction('PageDown', false)).toBe('next');
    expect(readerAction('PageUp', false)).toBe('prev');
  });

  it('swaps arrow directions right to left, but not Page Up/Down', () => {
    expect(readerAction('ArrowRight', true)).toBe('prev');
    expect(readerAction('a', true)).toBe('next');
    expect(readerAction('PageDown', true)).toBe('next');
  });

  it('maps the other shortcuts and ignores everything else', () => {
    expect(readerAction('Home', false)).toBe('first');
    expect(readerAction('End', false)).toBe('last');
    expect(readerAction('f', false)).toBe('fullscreen');
    expect(readerAction('M', false)).toBe('mode');
    expect(readerAction('t', false)).toBe('thumbs');
    expect(readerAction('Escape', false)).toBe('close');
    expect(readerAction('x', false)).toBeNull();
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
