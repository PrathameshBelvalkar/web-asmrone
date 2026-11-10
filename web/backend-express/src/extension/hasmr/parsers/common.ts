/** A text link on a page: where it goes (site path, percent-encoded) and what it says. */
export interface NamedLink {
  /** Last path segment of the link (e.g. `atolie-stars`), still percent-encoded. */
  readonly slug: string;
  readonly name: string;
}

const ALLOWED_IMAGE_HOSTS = new Set(['hentaiasmr.moe', 'blogger.googleusercontent.com']);

/** Cover addresses from the site or its image host only. Anything else is dropped. */
export function imageUrl(value: string | null | undefined, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.has(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

/** The last path segment of a site link, or null when it isn't a link on the site. */
export function slugOf(href: string | undefined, base: string, section: string): string | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.hostname !== 'hentaiasmr.moe' || !url.pathname.startsWith(`/${section}/`)) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  const slug = parts[parts.length - 1];
  return slug && slug !== section ? slug : null;
}

/** "864", "1K", "2.5K" → a number, or null. */
export function parseCount(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = /^([\d.]+)\s*([KkMm]?)$/.exec(text.trim());
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const scale =
    match[2]?.toUpperCase() === 'K' ? 1000 : match[2]?.toUpperCase() === 'M' ? 1_000_000 : 1;
  return Math.round(value * scale);
}

/** "01:27:01" or "12:05" → seconds, or null. */
export function parseClock(text: string | null | undefined): number | null {
  if (!text) return null;
  const parts = text
    .trim()
    .split(':')
    .map((p) => Number(p));
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !Number.isFinite(p) || p < 0))
    return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** An ISO 8601 duration like `PT01H27M01S` → seconds, or null. */
export function parseIsoDuration(text: string | null | undefined): number | null {
  const match = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(
    text ?? '',
  );
  if (!match || (match[1] === undefined && match[2] === undefined && match[3] === undefined))
    return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}
