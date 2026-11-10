import { load } from 'cheerio';
import { parseLabel, slugFromHref, type Category } from './listing.js';

export interface Chapter {
  readonly index: number;
  readonly title: string;
  /** Chapter start in seconds, from the player's data-value. */
  readonly start: number;
}

export interface Post {
  readonly workId: string;
  readonly title: string;
  readonly circle: string | null;
  readonly rjCode: string | null;
  readonly cv: readonly string[];
  readonly cover: string | null;
  readonly categories: readonly Category[];
  readonly date: string | null;
  readonly description: string | null;
  /** HLS playlist of the whole work (one file; chapters are offsets into it). */
  readonly streamUrl: string | null;
  readonly chapters: readonly Chapter[];
}

const MAX_DESCRIPTION = 4000;
const SITE_SUFFIX = /\s*[–-]\s*Japanese ASMR\s*$/;
const HLS_URL = /https:\/\/[^"'\s<>]+?\.m3u8/;

/** Parses one work page. Missing parts come back as null or empty lists. */
export function parsePost(html: string, workId: string): Post {
  const $ = load(html);

  const rawTitle = $('title').first().text().trim();
  const title = rawTitle.replace(SITE_SUFFIX, '').trim();

  const labelText = $('.entry-content p strong, .entry-title + p strong, p strong')
    .map((_, s) => $(s).text())
    .get()
    .find((text) => /^\s*\[\d+\]\[/.test(text));
  const { circle, rjCode: labelRj } = parseLabel(labelText ?? '');

  const rjCode = labelRj ?? /RJ Code:\s*(RJ\d+)/.exec($('body').text())?.[1] ?? null;

  const cv = $('p')
    .map((_, p) => $(p).text().trim())
    .get()
    .filter((text) => text.startsWith('CV:'))
    .flatMap((text) => text.slice(3).split(','))
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  const categories: Category[] = $('.post-meta-span-category a, a[rel~="category"]')
    .map((_, a) => ({ name: $(a).text().trim(), slug: slugFromHref($(a).attr('href') ?? '') }))
    .get()
    .filter((c) => c.name.length > 0 && c.slug.length > 0);

  const covers = $('img[data-src]')
    .map((_, img) => $(img).attr('data-src') ?? '')
    .get()
    .filter((src) => src.startsWith('https://'));
  const cover = covers.find((src) => /_img_main/.test(src)) ?? covers[0] ?? null;

  const descriptionText = $('[itemprop="description"]').first().text().replace(/\s+/g, ' ').trim();
  const description = descriptionText.length > 0 ? descriptionText.slice(0, MAX_DESCRIPTION) : null;

  const streamUrl = HLS_URL.exec(html)?.[0] ?? null;

  const byIndex = new Map<number, Chapter>();
  $('a[data-track-title]').each((_, a) => {
    const index = Number($(a).attr('data-index'));
    const start = Number($(a).attr('data-value'));
    if (!Number.isInteger(index) || !Number.isFinite(start)) return;
    if (byIndex.has(index)) return;
    byIndex.set(index, { index, title: $(a).attr('data-track-title')?.trim() ?? '', start });
  });
  const chapters = [...byIndex.values()].sort((a, b) => a.index - b.index);

  return {
    workId,
    title,
    circle,
    rjCode,
    cv,
    cover,
    categories,
    date: $('time[datetime]').first().attr('datetime') ?? null,
    description,
    streamUrl,
    chapters,
  };
}
