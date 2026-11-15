import { IMAGE_EXT, THREEHENTAI_MEDIA } from './constants.js';

/** File extension for the JSON's type letter (`j`, `w`, `p`, `g`). Unknown letters fall back to jpg. */
export const extOf = (t: string | undefined): string => (t !== undefined ? IMAGE_EXT[t] : undefined) ?? 'jpg';

/** Page `n` of a gallery: `https://3-hentai.xyz/{media_id}/{n}.{ext}`. */
export const pageUrl = (mediaId: string, n: number, ext: string): string => `${THREEHENTAI_MEDIA}/${mediaId}/${n}.${ext}`;

/** The thumbnail of page `n`: `…/{n}t.{ext}`. */
export const thumbUrl = (mediaId: string, n: number, ext: string): string => `${THREEHENTAI_MEDIA}/${mediaId}/${n}t.${ext}`;

export const coverUrl = (mediaId: string, ext: string): string => `${THREEHENTAI_MEDIA}/${mediaId}/cover.${ext}`;

/**
 * Covers to try after `cover`: the other file types, the small card thumbnail, then the first page's
 * thumbnail and the first page itself (the page list is what the reader uses, so those exist most often).
 */
export function coverFallbacks(mediaId: string, cover: string, firstPage: { url: string; thumb: string } | undefined): string[] {
  const list = [
    ...['webp', 'jpg'].map((ext) => coverUrl(mediaId, ext)),
    ...['webp', 'jpg'].map((ext) => `${THREEHENTAI_MEDIA}/${mediaId}/thumb.${ext}`),
    ...(firstPage ? [firstPage.thumb, firstPage.url] : []),
  ];
  return [...new Set(list)].filter((url) => url !== cover);
}

/** Seconds since 1970 → ISO 8601, or null. */
export function isoFromUnix(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}
