/** HLS playlist helpers for the media proxy. Playlists are small text files, so they are rewritten in memory. */

const URI_ATTRIBUTE = /URI="([^"]+)"/g;

/** True for an HLS playlist, by content type or by the `.m3u8` path. */
export function isHlsPlaylist(url: string, contentType: unknown): boolean {
  if (typeof contentType === 'string' && contentType.toLowerCase().includes('mpegurl')) return true;
  return new URL(url).pathname.toLowerCase().endsWith('.m3u8');
}

/**
 * Rewrites every URI in a playlist to an absolute URL and then to `proxied(absolute)`. Lines that
 * are not http(s) are left as they are. `#EXT-X-KEY`-style `URI="…"` attributes are rewritten too.
 */
export function rewriteHlsPlaylist(text: string, baseUrl: string, proxied: (absolute: string) => string): string {
  const resolve = (uri: string): string | null => {
    let absolute: URL;
    try {
      absolute = new URL(uri, baseUrl);
    } catch {
      return null;
    }
    if (absolute.protocol !== 'https:' && absolute.protocol !== 'http:') return null;
    return proxied(absolute.href);
  };

  return text
    .split('\n')
    .map((raw) => {
      // Keep each line's own line ending (\r\n or \n).
      const eol = raw.endsWith('\r') ? '\r' : '';
      const line = eol === '\r' ? raw.slice(0, -1) : raw;
      const trimmed = line.trim();
      if (trimmed.length === 0) return raw;
      if (trimmed.startsWith('#')) {
        return line.replace(URI_ATTRIBUTE, (match, uri: string) => {
          const rewritten = resolve(uri);
          return rewritten === null ? match : `URI="${rewritten}"`;
        }) + eol;
      }
      return (resolve(trimmed) ?? line) + eol;
    })
    .join('\n');
}
