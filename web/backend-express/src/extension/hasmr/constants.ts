/**
 * hentaiasmr.moe source. Ids from this source start with `hasmr:` so the router sends them here.
 * Album = work (the RJ code, lowercase), track = one MP3 of a work, actor and circle = artists.
 */
export const HASMR_PREFIX = 'hasmr:';
export const HASMR_SITE = 'https://hentaiasmr.moe';
export const HASMR_AUDIO_HOST = 'cdn.hentaiasmr.moe';
/** Sent with every request. Plain, honest identity; no browser impersonation. */
export const APP_USER_AGENT = 'EchoASMR/1.0';

export const isHasmrId = (id: string): boolean => id.startsWith(HASMR_PREFIX);
export const workAlbumId = (slug: string): string => `${HASMR_PREFIX}${slug}`;
export const trackId = (slug: string, index: number): string => `${HASMR_PREFIX}${slug}#${index}`;
export const actorArtistId = (slug: string): string => `${HASMR_PREFIX}actor:${slug}`;
export const categoryArtistId = (slug: string): string => `${HASMR_PREFIX}cat:${slug}`;

/** Stream id: the MP3's address, base64url-encoded so it can travel as an id. */
export const streamId = (url: string): string =>
  `${HASMR_PREFIX}m:${Buffer.from(url, 'utf8').toString('base64url')}`;

/** The MP3 address inside a stream id, or null unless it is one of the site's own audio files. */
export function decodeStreamId(id: string): string | null {
  const match = /^hasmr:m:([A-Za-z0-9_-]+)$/.exec(id);
  if (!match) return null;
  const url = Buffer.from(match[1] as string, 'base64url').toString('utf8');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const ok =
    parsed.protocol === 'https:' &&
    parsed.hostname === HASMR_AUDIO_HOST &&
    /^\/mf\/\d+\/\d+\.mp3$/.test(parsed.pathname);
  return ok ? url : null;
}

/** The work slug inside an album or track id (`hasmr:rj01742594` or `hasmr:rj01742594#2`). */
export function workSlugOf(id: string): string {
  return id.slice(HASMR_PREFIX.length).split('#')[0] ?? '';
}
