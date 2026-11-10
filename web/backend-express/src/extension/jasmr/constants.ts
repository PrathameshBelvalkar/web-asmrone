/**
 * japaneseasmr.com source. Ids from this source start with `jasmr:` so the router can send them to
 * this extension. The asmr.one ids have no prefix.
 */
export const JASMR_PREFIX = 'jasmr:';
export const JASMR_SITE = 'https://japaneseasmr.com';
/** Sent with every site and stream request. The stream hosts refuse requests without this Referer. */
export const JASMR_REFERER = `${JASMR_SITE}/`;
export const JASMR_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export const isJasmrId = (id: string): boolean => id.startsWith(JASMR_PREFIX);

/** Work = album. Work ids are the numbers in the post URL. */
export const workAlbumId = (workId: string): string => `${JASMR_PREFIX}${workId}`;

/** Chapter = track. `#n` is the chapter index in the work's list. */
export const chapterTrackId = (workId: string, index: number): string => `${JASMR_PREFIX}${workId}#${index}`;

/** Circle = artist. The slug is the path segment of the circle's category page, as it appears in the link. */
export const artistId = (slug: string): string => `${JASMR_PREFIX}cat:${slug}`;

/** Streamable id: the HLS playlist URL, base64url-encoded so it can travel as an id. */
export const streamId = (url: string): string => `${JASMR_PREFIX}m3u8:${Buffer.from(url, 'utf8').toString('base64url')}`;

export function workIdOf(id: string): string {
  const body = id.slice(JASMR_PREFIX.length);
  return body.split('#')[0] ?? body;
}

export function parseChapterId(id: string): { workId: string; index: number } | null {
  const match = /^jasmr:(\d+)#(\d+)$/.exec(id);
  return match ? { workId: match[1] as string, index: Number(match[2]) } : null;
}

export function parseArtistId(id: string): string | null {
  const match = /^jasmr:cat:(.+)$/.exec(id);
  return match ? (match[1] as string) : null;
}

/** The playlist URL inside a stream id, or null when the id is not one of ours or is not https. */
export function decodeStreamId(id: string): string | null {
  const match = /^jasmr:m3u8:([A-Za-z0-9_-]+)$/.exec(id);
  if (!match) return null;
  const url = Buffer.from(match[1] as string, 'base64url').toString('utf8');
  return url.startsWith('https://') ? url : null;
}
