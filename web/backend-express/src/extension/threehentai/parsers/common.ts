import type { CheerioAPI } from 'cheerio';
import type { MangaTagKind } from '../../../models/manga.js';
import { MANGA_TAG_KINDS } from '../../../models/manga.js';
import { THREEHENTAI_MEDIA_HOST, THREEHENTAI_SITE } from '../constants.js';

/** Image addresses on the site's media host only. Anything else is dropped. */
export function mediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, THREEHENTAI_SITE);
    return url.protocol === 'https:' && url.hostname === THREEHENTAI_MEDIA_HOST ? url.href : null;
  } catch {
    return null;
  }
}

/** "864", "21K", "1.2M" → a number, or null. */
export function parseQty(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = /^([\d.]+)\s*([KkMm]?)$/.exec(text.trim());
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  const unit = (match[2] ?? '').toLowerCase();
  return Math.round(unit === 'k' ? base * 1_000 : unit === 'm' ? base * 1_000_000 : base);
}

/** `/tag/big-breasts/` → `{ kind: 'tag', slug: 'big-breasts' }`, or null for any other link. */
export function tagLinkOf(href: string | undefined): { kind: MangaTagKind; slug: string } | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, THREEHENTAI_SITE);
  } catch {
    return null;
  }
  if (url.origin !== THREEHENTAI_SITE) return null;
  const [kind, slug, ...rest] = url.pathname.split('/').filter(Boolean);
  if (kind === undefined || slug === undefined || rest.length > 0) return null;
  if (!(MANGA_TAG_KINDS as readonly string[]).includes(kind)) return null;
  return { kind: kind as MangaTagKind, slug };
}

/** The highest `page=` number in the page's pagination links, or null when there are none. */
export function lastPageOf($: CheerioAPI): number | null {
  let last: number | null = null;
  $('.pagination a[href], nav a[href]').each((_, element) => {
    const href = $(element).attr('href') ?? '';
    const match = /[?&]page=(\d+)/.exec(href);
    if (!match) return;
    const n = Number(match[1]);
    if (last === null || n > last) last = n;
  });
  return last;
}

/** True when the page links to a next page. */
export function hasNextPage($: CheerioAPI, page: number): boolean {
  if ($('a[rel="next"]').length > 0) return true;
  const last = lastPageOf($);
  return last !== null && last > page;
}
