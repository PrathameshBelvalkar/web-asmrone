import { load } from 'cheerio';

export interface Category {
  readonly name: string;
  /** Path segment of the category link, still percent-encoded (it is used in the next request). */
  readonly slug: string;
}

export interface ListingCard {
  readonly workId: string;
  readonly title: string;
  /** Circle name from the `[circle]` label. */
  readonly circle: string | null;
  readonly rjCode: string | null;
  readonly cv: readonly string[];
  readonly cover: string | null;
  readonly categories: readonly Category[];
  readonly date: string | null;
}

export interface Listing {
  readonly cards: readonly ListingCard[];
  /** Next page number, or null on the last page. */
  readonly nextPage: number | null;
}

const WORK_PATH = /\/(\d+)\/?(?:[?#].*)?$/;
const PAGE_PATH = /\/page\/(\d+)\/?$/;

/** Work id from a post URL such as `https://japaneseasmr.com/151994/`. */
export function workIdFromUrl(url: string): string | null {
  const match = WORK_PATH.exec(url);
  return match ? (match[1] as string) : null;
}

/** `[261028][Circle] Title [RJ01746828]` → circle and RJ code. */
export function parseLabel(label: string): { circle: string | null; rjCode: string | null } {
  const circle = /^\[\d+\]\[([^\]]+)\]/.exec(label.trim());
  const rj = /\[(RJ\d+)\]\s*$/.exec(label.trim());
  return { circle: circle ? (circle[1] as string) : null, rjCode: rj ? (rj[1] as string) : null };
}

/** Lists the post cards on one listing page (home, category, tag or search pages). */
export function parseListing(html: string, currentPage: number): Listing {
  const $ = load(html);
  const cards: ListingCard[] = [];

  $('li.site-archive-post').each((_, element) => {
    const card = $(element);
    const link = card.find('h2.entry-title a').first();
    const workId = workIdFromUrl(link.attr('href') ?? '');
    if (workId === null) return;

    const { circle, rjCode } = parseLabel(card.find('p strong').first().text());
    const cv = card
      .find('p')
      .map((_, p) => $(p).text().trim())
      .get()
      .filter((text) => text.startsWith('CV:'))
      .flatMap((text) => text.slice(3).split(','))
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    const dataSrc = card.find('img').first().attr('data-src') ?? '';
    const cover = dataSrc.startsWith('https://') ? dataSrc : null;

    const categories: Category[] = card
      .find('.post-meta-span-category a')
      .map((_, a) => ({ name: $(a).text().trim(), slug: slugFromHref($(a).attr('href') ?? '') }))
      .get()
      .filter((c) => c.slug.length > 0);

    cards.push({
      workId,
      title: link.text().trim(),
      circle,
      rjCode,
      cv,
      cover,
      categories,
      date: card.find('time').attr('datetime') ?? null,
    });
  });

  // Pages are numbered without gaps, so a link to any later page means the next one exists.
  const hasLaterPage = $('a[href]')
    .toArray()
    .some((element) => {
      const match = PAGE_PATH.exec($(element).attr('href') ?? '');
      return match !== null && Number(match[1]) > currentPage;
    });
  const nextPage = hasLaterPage && cards.length > 0 ? currentPage + 1 : null;

  return { cards, nextPage };
}

/** Last path segment of a link, left percent-encoded so it can be used in the next request. */
export function slugFromHref(href: string): string {
  try {
    const parts = new URL(href).pathname.split('/').filter((p) => p.length > 0);
    return parts[parts.length - 1] ?? '';
  } catch {
    return '';
  }
}
