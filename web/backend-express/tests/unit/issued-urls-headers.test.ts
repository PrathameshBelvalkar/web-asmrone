import { describe, expect, it } from 'vitest';
import { IssuedUrls } from '../../src/stores/issued-urls.js';

describe('IssuedUrls headers', () => {
  it('returns the headers an issued URL was added with', () => {
    const issued = new IssuedUrls(10);
    issued.add('https://cdn.example/a.m3u8', { Referer: 'https://site.example/' });
    expect(issued.headersOf('https://cdn.example/a.m3u8')).toEqual({ Referer: 'https://site.example/' });
  });

  it('gives empty headers for URLs added without them, and undefined for unknown URLs', () => {
    const issued = new IssuedUrls(10);
    issued.add('https://cdn.example/plain.mp3');
    expect(issued.headersOf('https://cdn.example/plain.mp3')).toEqual({});
    expect(issued.headersOf('https://cdn.example/never.mp3')).toBeUndefined();
  });

  it('replaces the headers when a URL is issued again', () => {
    const issued = new IssuedUrls(10);
    issued.add('u', { Referer: 'a' });
    issued.add('u', { Referer: 'b' });
    expect(issued.headersOf('u')).toEqual({ Referer: 'b' });
    expect(issued.size).toBe(1);
  });
});
