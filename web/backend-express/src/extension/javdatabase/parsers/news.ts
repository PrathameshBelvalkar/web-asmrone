import { load } from 'cheerio';
import type { JavList, JavNewsItem, JavNewsPost, JavRankedEntry } from '../../../models/jav.js';
import { JAVDATABASE_SITE } from '../constants.js';
import {
  clean,
  hasNextPage,
  idolSlugOf,
  httpsUrl,
  labelText,
  labelledValues,
  lastPageOf,
  mainOf,
  movieLinkOf,
  numberIn,
  refsIn,
} from './common.js';

const POST_PATH = /^\/?(\d{4})\/(\d{2})\/(\d{2})\/([a-z0-9][a-z0-9%._-]*)\/?$/i;

/** `https://…/2026/11/13/slug/` → `2026/11/13/slug`, or null for any other address. */
export function newsPathOf(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, JAVDATABASE_SITE);
    if (url.origin !== JAVDATABASE_SITE) return null;
    const match = POST_PATH.exec(url.pathname);
    return match ? `${match[1]}/${match[2]}/${match[3]}/${match[4]}` : null;
  } catch {
    return null;
  }
}

const dateOfPath = (path: string): string => path.slice(0, 10).replace(/\//g, '-');

/** A page of the blog or of one blog category. */
export function parseNewsList(html: string, page: number): JavList<JavNewsItem> {
  const $ = load(html);
  const items: JavNewsItem[] = [];
  const seen = new Set<string>();
  mainOf($)
    .find('h2.blog-post-title')
    .each((_, h2) => {
      const path = newsPathOf($(h2).closest('a').attr('href'));
      if (path === null || seen.has(path)) return;
      seen.add(path);
      const card = $(h2).closest('.card');
      const summary = clean(card.find('p.card-text a.text-body').first().text()).replace(
        /\s*\[(?:…|&hellip;|\.\.\.)\]$/,
        '…',
      );
      items.push({
        path,
        url: `${JAVDATABASE_SITE}/${path}/`,
        title: clean($(h2).text()),
        date: dateOfPath(path),
        categories: refsIn($, card.find('.category-badge'), 'category'),
        summary,
        image: httpsUrl(card.find('img.wp-post-image').first().attr('src')),
      });
    });
  return { items, page, lastPage: lastPageOf($), hasMore: hasNextPage($, page) };
}

/** A blog post: its title, first paragraph, and the ranked list of the weekly posts. */
export function parseNewsPost(html: string, path: string): JavNewsPost {
  const $ = load(html);
  const main = mainOf($);
  const content = main.find('.entry-content').first();
  const ranked: JavRankedEntry[] = [];
  content.find('.list-group-item').each((index, element) => {
    const item = $(element);
    const head = item.find('h5 a[href]').first();
    const href = head.attr('href');
    const rank = numberIn(clean(item.children('div').first().text())) ?? index + 1;
    const image = httpsUrl(item.find('img').first().attr('src'));
    const info = labelledValues($, item);
    const movie = movieLinkOf(href);
    if (movie !== null) {
      const dvdId = movie.kind === 'censored' ? clean(head.text()) || null : null;
      ranked.push({
        rank,
        type: 'movie',
        movie: {
          slug: movie.slug,
          kind: movie.kind,
          dvdId,
          title: labelText(info, 'Title') ?? dvdId ?? movie.slug,
          releaseDate: null,
          upcoming: false,
          cover: image,
          studio: refsIn($, item, 'studios')[0] ?? null,
        },
      });
      return;
    }
    const idol = idolSlugOf(href);
    if (idol !== null) {
      const age = labelText(info, 'Age');
      ranked.push({
        rank,
        type: 'idol',
        idol: {
          slug: idol,
          name: clean(head.text()) || idol,
          photo: image,
          age: age === null ? null : numberIn(age),
        },
      });
    }
  });
  return {
    path,
    url: `${JAVDATABASE_SITE}/${path}/`,
    title: clean(main.find('h1').first().text()),
    date: dateOfPath(path),
    intro: clean(content.children('p').first().text()),
    ranked,
  };
}
