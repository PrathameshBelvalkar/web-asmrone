/**
 * jasmr.net source. Ids from this source start with `jnet:` so the router sends them here.
 * Album = work (RJ code), track = one track of a work, circle = artist.
 */
export const JNET_PREFIX = 'jnet:';
export const JNET_SITE = 'https://www.jasmr.net';
/** Sent with every request. Plain, honest identity; no browser impersonation. */
export const APP_USER_AGENT = 'EchoASMR/1.0';

export const isJnetId = (id: string): boolean => id.startsWith(JNET_PREFIX);
export const workAlbumId = (code: string): string => `${JNET_PREFIX}${code}`;
export const trackId = (code: string, index: number): string => `${JNET_PREFIX}${code}#${index}`;
export const circleArtistId = (name: string): string =>
  `${JNET_PREFIX}circle:${encodeURIComponent(name)}`;

/** Stream id: the audio file's address, base64url-encoded so it can travel as an id. */
export const streamId = (url: string): string =>
  `${JNET_PREFIX}m:${Buffer.from(url, 'utf8').toString('base64url')}`;

/** The audio address inside a stream id, or null when the id isn't one of ours or the address isn't on the site. */
export function decodeStreamId(id: string): string | null {
  const match = /^jnet:m:([A-Za-z0-9_-]+)$/.exec(id);
  if (!match) return null;
  const url = Buffer.from(match[1] as string, 'base64url').toString('utf8');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  return parsed.origin === JNET_SITE && parsed.pathname.startsWith('/media/audio/') ? url : null;
}

/** The work code inside an album or track id (`jnet:RJ01670247` or `jnet:RJ01670247#2`). */
export function workCodeOf(id: string): string {
  return id.slice(JNET_PREFIX.length).split('#')[0] ?? '';
}

/** The circle name inside an artist id (`jnet:circle:<name>`), or null. */
export function circleNameOf(id: string): string | null {
  const prefix = `${JNET_PREFIX}circle:`;
  return id.startsWith(prefix) ? decodeURIComponent(id.slice(prefix.length)) : null;
}
