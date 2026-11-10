import { load } from 'cheerio';
import { HASMR_SITE } from '../constants.js';
import { imageUrl, parseClock, parseCount } from './common.js';

export interface HasmrCard {
  /** Work slug, lowercase (e.g. `rj01742594`). The work's address is `/<slug>.html`. */
  readonly slug: string;
  readonly title: string;
  readonly cover: string | null;
  readonly views: number | null;
  /** Length in seconds, from the card's clock. */
  readonly durationSec: number | null;
}

export interface HasmrListing {
  readonly cards: HasmrCard[];
  /** Full address of the next listing page on the site, or null on the last page. */
  readonly nextUrl: string | null;
}

const WORK_HREF = /\/(rj\d+)\.html$/i;

/**
 * The works on a listing page (`article.loop-video` cards) and the link to the next page.
 * Only the cards are read, so links in the page's chrome (menus, ads, the hidden trap page) are
 * never followed.
 */
export function parseListing(html: string, pageUrl: string): HasmrListing {
  const $ = load(html);
  const cards: HasmrCard[] = [];
  const seen = new Set<string>();
  $('article.loop-video').each((_, element) => {
    const card = $(element);
    const link = card.find('a[href]').first();
    const match = WORK_HREF.exec(new URL(link.attr('href') ?? '', HASMR_SITE).pathname);
    if (!match) return;
    const slug = (match[1] ?? '').toLowerCase();
    if (seen.has(slug)) return;
    seen.add(slug);
    const img = card.find('img').first();
    const alt = img.attr('alt') ?? '';
    const title =
      (link.attr('title') ?? '').trim() ||
      alt.replace(/^\[RJ\d+\]\s*-?\s*/i, '').trim() ||
      slug.toUpperCase();
    cards.push({
      slug,
      title,
      cover: imageUrl(img.attr('data-src') ?? img.attr('src'), HASMR_SITE),
      // The eye icon has no text, so the count is the whole text.
      views: parseCount(card.find('.views').text()),
      durationSec: parseClock(card.find('.duration').text()),
    });
  });
  const next = $('link[rel="next"]').attr('href') ?? null;
  return { cards, nextUrl: next ? new URL(next, pageUrl).href : null };
}
