import { load } from 'cheerio';
import type { MangaCard, MangaList } from '../../../models/manga.js';
import { THREEHENTAI_SITE } from '../constants.js';
import { hasNextPage, lastPageOf, mediaUrl, parseQty, tagLinkOf } from './common.js';

const GALLERY_HREF = /^\/d\/(\d+)\/?$/;

/**
 * The gallery cards on a listing page (Browse, search, tag, artist and the other lists). Browse
 * also has a short "popular at the moment" strip above the newest list; only the last list on the
 * page is read, so each page holds one run of the listing.
 */
export function parseListing(html: string, page: number): MangaList {
  const $ = load(html);
  const containers = $('.listing-container');
  const cards = containers.length > 0 ? containers.last().find('div.doujin') : $('div.doujin');
  const items: MangaCard[] = [];
  const seen = new Set<string>();
  cards.each((_, element) => {
    const card = $(element);
    const link = card.find('a.cover[href]').first();
    const match = GALLERY_HREF.exec(new URL(link.attr('href') ?? '', THREEHENTAI_SITE).pathname);
    if (!match) return;
    const id = match[1] ?? '';
    if (seen.has(id)) return;
    seen.add(id);
    const img = link.find('img').first();
    const cover = mediaUrl(img.attr('data-src') ?? img.attr('src'));
    if (cover === null) return;
    const titleEl = card.find('.title').first();
    const flag = /\bflag-([a-z]{2,3})\b/.exec(titleEl.attr('class') ?? '');
    const padding = /padding:\s*0\s+0\s+([\d.]+)%/.exec(link.attr('style') ?? '');
    items.push({
      id,
      title: titleEl.text().trim() || (img.attr('alt') ?? '').trim() || `#${id}`,
      language: flag ? (flag[1] ?? null) : null,
      cover,
      coverFallbacks: fallbacksOf(img.attr('data-fallbacks')).filter((url) => url !== cover),
      aspect: padding ? Number(padding[1]) / 100 : null,
      tagIds: (card.attr('data-tags') ?? '')
        .split(/\s+/)
        .filter((s) => /^\d+$/.test(s))
        .map(Number),
    });
  });
  // A tag, artist or other single-name list names itself in the heading, with its gallery count.
  const heading = $('h1 a.name[href]').first();
  const link = tagLinkOf(heading.attr('href'));
  const tag =
    link === null
      ? null
      : { kind: link.kind, slug: link.slug, name: heading.text().trim() || link.slug, count: parseQty(heading.attr('data-qty')), id: null };
  return { tag, items, page, lastPage: lastPageOf($), hasMore: hasNextPage($, page) };
}

function fallbacksOf(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return [...new Set(list.map((v) => (typeof v === 'string' ? mediaUrl(v) : null)).filter((v) => v !== null))];
  } catch {
    return [];
  }
}
