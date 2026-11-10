import { load } from 'cheerio';
import { JASMR_SITE } from '../constants.js';
import { workIdFromUrl } from './listing.js';

/** One entry on the site's index pages (`/cv/`, `/circles/`, `/tags/`). */
export interface TermEntry {
  /** Path of the entry's listing page, still percent-encoded, e.g. `/tag/yuka-hinata/`. */
  readonly path: string;
  readonly name: string;
  /** Number of works the site lists for it. */
  readonly count: number;
}

/** A work in the homepage's "Featured Posts" box. The site shows only its cover there. */
export interface FeaturedWork {
  readonly workId: string;
  readonly cover: string | null;
  readonly rjCode: string | null;
}

const SITE_HOST = new URL(JASMR_SITE).host;

/**
 * Entries of an index page, most works first. Each entry is a link whose `title` is the work count,
 * e.g. `<a href="…/tag/wife/" title="(23)"><span class="tag-groups-label">wife</span></a>`.
 * An entry listed more than once is kept once.
 */
export function parseTermIndex(html: string): TermEntry[] {
  const $ = load(html);
  const byPath = new Map<string, TermEntry>();
  $('span.tag-groups-tag > a').each((_, element) => {
    const link = $(element);
    const count = /^\((\d+)\)$/.exec((link.attr('title') ?? '').trim());
    const name = link.find('.tag-groups-label').text().trim() || link.text().trim();
    let url: URL;
    try {
      url = new URL(link.attr('href') ?? '', JASMR_SITE);
    } catch {
      return;
    }
    if (!count || !name || url.host !== SITE_HOST) return;
    const entry = { path: url.pathname, name, count: Number(count[1]) };
    const known = byPath.get(entry.path);
    if (!known || known.count < entry.count) byPath.set(entry.path, entry);
  });
  return [...byPath.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The works in the homepage's "Featured Posts" box, in order. */
export function parseFeatured(html: string): FeaturedWork[] {
  const $ = load(html);
  const box = $('.widget')
    .filter((_, widget) => /Featured Posts/i.test($(widget).find('.widget-title').text()))
    .first();
  const works: FeaturedWork[] = [];
  box.find('a[href]').each((_, element) => {
    const link = $(element);
    const workId = workIdFromUrl(link.attr('href') ?? '');
    if (workId === null || works.some((w) => w.workId === workId)) return;
    const img = link.find('img').first();
    // Images load lazily: the real address is in data-src.
    const cover = img.attr('data-src') ?? img.attr('src') ?? null;
    const usable = cover !== null && /^https?:/.test(cover) ? cover : null;
    const rj = usable ? /(RJ\d+)/.exec(usable) : null;
    works.push({ workId, cover: usable, rjCode: rj ? (rj[1] as string) : null });
  });
  return works;
}
