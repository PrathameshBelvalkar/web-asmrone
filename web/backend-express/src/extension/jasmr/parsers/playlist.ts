/**
 * Total length of an HLS media playlist in seconds (the sum of its `#EXTINF` durations), or the
 * first variant's address when it is a master playlist. Null when it has neither.
 */
export function readPlaylist(
  text: string,
  url: string,
): { readonly seconds: number } | { readonly variant: string } | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const variantAt = lines.findIndex((line) => line.startsWith('#EXT-X-STREAM-INF'));
  if (variantAt >= 0) {
    const next = lines
      .slice(variantAt + 1)
      .find((line) => line.length > 0 && !line.startsWith('#'));
    return next === undefined ? null : { variant: new URL(next, url).href };
  }
  let seconds = 0;
  let found = false;
  for (const line of lines) {
    const match = /^#EXTINF:([\d.]+)/.exec(line);
    if (match) {
      seconds += Number(match[1]);
      found = true;
    }
  }
  // Rounded to the millisecond: adding many fractional durations leaves float noise.
  return found ? { seconds: Math.round(seconds * 1000) / 1000 } : null;
}
