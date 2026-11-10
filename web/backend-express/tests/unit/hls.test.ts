import { describe, expect, it } from 'vitest';
import { isHlsPlaylist, rewriteHlsPlaylist } from '../../src/lib/hls.js';

const PLAYLIST = 'https://v.example.test/RJ1.m3u8';

describe('HLS playlist detection', () => {
  it('recognises playlists by content type or by .m3u8 path', () => {
    expect(isHlsPlaylist(PLAYLIST, 'application/vnd.apple.mpegurl')).toBe(true);
    expect(isHlsPlaylist('https://x.test/a.m3u8?token=1', undefined)).toBe(true);
    expect(isHlsPlaylist('https://x.test/a.ts', 'video/mp2t')).toBe(false);
  });
});

describe('HLS playlist rewriting', () => {
  const proxied = (absolute: string) => `/api/proxy?url=${encodeURIComponent(absolute)}`;

  it('turns relative segment lines into absolute proxy URLs', () => {
    const text = '#EXTM3U\n#EXTINF:10,\nRJ1/seg_0.ts\n#EXTINF:10,\nRJ1/seg_1.ts\n#EXT-X-ENDLIST\n';
    const out = rewriteHlsPlaylist(text, PLAYLIST, proxied);
    expect(out.split('\n')).toEqual([
      '#EXTM3U',
      '#EXTINF:10,',
      '/api/proxy?url=' + encodeURIComponent('https://v.example.test/RJ1/seg_0.ts'),
      '#EXTINF:10,',
      '/api/proxy?url=' + encodeURIComponent('https://v.example.test/RJ1/seg_1.ts'),
      '#EXT-X-ENDLIST',
      '',
    ]);
  });

  it('rewrites URI attributes on tag lines (keys, maps)', () => {
    const text = '#EXT-X-KEY:METHOD=AES-128,URI="keys/k.bin"\n#EXT-X-MAP:URI="init.mp4"\n';
    const out = rewriteHlsPlaylist(text, PLAYLIST, proxied);
    expect(out).toContain('URI="/api/proxy?url=' + encodeURIComponent('https://v.example.test/keys/k.bin') + '"');
    expect(out).toContain('URI="/api/proxy?url=' + encodeURIComponent('https://v.example.test/init.mp4') + '"');
  });

  it('keeps lines whose URI is not http(s)', () => {
    const text = '#EXTM3U\ndata:application/octet-stream;base64,AAAA\n';
    expect(rewriteHlsPlaylist(text, PLAYLIST, proxied)).toBe(text);
  });

  it('keeps CRLF line endings', () => {
    const out = rewriteHlsPlaylist('#EXTM3U\r\nseg.ts\r\n', PLAYLIST, proxied);
    expect(out).toBe('#EXTM3U\r\n/api/proxy?url=' + encodeURIComponent('https://v.example.test/seg.ts') + '\r\n');
  });
});
