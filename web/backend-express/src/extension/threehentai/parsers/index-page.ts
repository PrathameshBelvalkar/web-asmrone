import { load } from 'cheerio';
import type { MangaIndex, MangaTag } from '../../../models/manga.js';
import { lastPageOf, parseQty, tagLinkOf } from './common.js';

/** The names on an A–Z index page (`/tags/`, `/artists/`, …), with their gallery counts. */
export function parseIndexPage(html: string, page: number): MangaIndex {
  const $ = load(html);
  const items: MangaTag[] = [];
  const seen = new Set<string>();
  $('a.name[href]').each((_, element) => {
    const a = $(element);
    const link = tagLinkOf(a.attr('href'));
    if (link === null) return;
    const key = `${link.kind}:${link.slug}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      kind: link.kind,
      slug: link.slug,
      name: a.text().trim() || link.slug,
      count: parseQty(a.attr('data-qty')),
      id: null,
    });
  });
  return { items, page, lastPage: lastPageOf($) };
}
