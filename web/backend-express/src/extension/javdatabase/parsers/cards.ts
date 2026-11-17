import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { JavIdolCard, JavList, JavMovieCard, JavMovieList } from '../../../models/jav.js';
import {
  clean,
  dateIn,
  hasNextPage,
  idolSlugOf,
  httpsUrl,
  lastPageOf,
  mainOf,
  movieLinkOf,
  numberIn,
  refsIn,
} from './common.js';

/**
 * The movie cards inside `scope`. Sponsored cards have the same shape but link off-site, so a card
 * counts only when its links lead to a movie page on the site.
 */
export function movieCardsIn($: CheerioAPI, scope: Cheerio<AnyNode>): JavMovieCard[] {
  const items: JavMovieCard[] = [];
  const seen = new Set<string>();
  scope.find('.card').each((_, element) => {
    const card = $(element);
    const thumb = card.find('.movie-cover-thumb').first();
    if (thumb.length === 0) return;
    const head = card.find('p.display-6 a[href]').first();
    const link = movieLinkOf(head.attr('href'));
    if (link === null || seen.has(`${link.kind}:${link.slug}`)) return;
    seen.add(`${link.kind}:${link.slug}`);
    const footer = card.find('.mt-auto').first();
    const headText = clean(head.text());
    const footerTitle = clean(footer.find('a.cut-text').first().text());
    // Censored cards show the DVD ID on top and the title below; uncensored ones have no DVD ID
    // and show the title on top.
    const dvdId = link.kind === 'censored' && headText.length > 0 ? headText : null;
    items.push({
      slug: link.slug,
      kind: link.kind,
      dvdId,
      title: footerTitle || headText || link.slug,
      releaseDate: dateIn(footer.text()),
      upcoming: false,
      cover: httpsUrl(thumb.find('img').first().attr('src')),
      studio: refsIn($, card, 'studios')[0] ?? null,
    });
  });
  return items;
}

/** The idol cards inside `scope`. */
export function idolCardsIn($: CheerioAPI, scope: Cheerio<AnyNode>): JavIdolCard[] {
  const items: JavIdolCard[] = [];
  const seen = new Set<string>();
  scope.find('.card').each((_, element) => {
    const card = $(element);
    const thumb = card.find('.idol-thumb').first();
    if (thumb.length === 0) return;
    const head = card.find('p.display-6 a[href]').first();
    const slug = idolSlugOf(head.attr('href'));
    if (slug === null || seen.has(slug)) return;
    seen.add(slug);
    const age = card.find('.idol-info a').first();
    items.push({
      slug,
      name: clean(head.text()) || slug,
      photo: httpsUrl(thumb.find('img').first().attr('src')),
      age: age.length > 0 ? numberIn(age.text()) : null,
    });
  });
  return items;
}

/** A movie list: Movies, Uncensored, a genre, studio or director, or movie search. */
export function parseMovieList(html: string, page: number): JavMovieList {
  const $ = load(html);
  const heading = clean($('h1.entry-title').first().text()).replace(/\s+JAV Videos$/i, '');
  return {
    heading: heading.length > 0 ? heading : null,
    items: movieCardsIn($, mainOf($)),
    page,
    lastPage: lastPageOf($),
    hasMore: hasNextPage($, page),
  };
}

/** An idol list: Idols (with any filter) or idol search. */
export function parseIdolList(html: string, page: number): JavList<JavIdolCard> {
  const $ = load(html);
  return {
    items: idolCardsIn($, mainOf($)),
    page,
    lastPage: lastPageOf($),
    hasMore: hasNextPage($, page),
  };
}
