import { load } from 'cheerio';
import { HASMR_SITE } from '../constants.js';
import { imageUrl, parseIsoDuration, slugOf, type NamedLink } from './common.js';

export interface HasmrTrack {
  /** Track number from the file name, starting at 1. */
  readonly number: number;
  /** The MP3's address on the site's audio host. */
  readonly url: string;
}

export interface HasmrWork {
  /** The site's numeric post id (the folder of the work's MP3s). */
  readonly postId: string | null;
  /** The Japanese title, without the RJ code and the site name. */
  readonly title: string | null;
  readonly cover: string | null;
  readonly circle: string | null;
  readonly voices: string[];
  readonly categories: NamedLink[];
  readonly tags: NamedLink[];
  readonly actors: NamedLink[];
  readonly durationSec: number | null;
  readonly tracks: HasmrTrack[];
}

/** The audio files of a work: exactly the site's audio host and folder layout. */
const TRACK_URL = /^https:\/\/cdn\.hentaiasmr\.moe\/mf\/(\d+)\/(\d+)\.mp3$/;

/**
 * One work page. Only the work's own metadata is read: the header text, its tag and category
 * labels, and its cast. Related works on the page are ignored, and so is every link to another
 * host, including the ad videos embedded in the page.
 */
export function parseWork(html: string, pageUrl: string): HasmrWork {
  const $ = load(html);
  const description = $('meta[name="twitter:description"]').attr('content') ?? '';
  const circle = /Circle\s*:\s*(.+?)\s*Release\s*:/.exec(description)?.[1]?.trim() ?? null;
  const voiceText = /Voice\s*:\s*(.+?)\s*Age Ratings\s*:/.exec(description)?.[1] ?? '';
  const voices = voiceText
    .split('/')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  const tracks = new Map<number, string>();
  let postId: string | null = null;
  for (const match of html.matchAll(/https:\/\/cdn\.hentaiasmr\.moe\/mf\/\d+\/\d+\.mp3/g)) {
    const parsed = TRACK_URL.exec(match[0]);
    if (!parsed) continue;
    postId ??= parsed[1] ?? null;
    if (parsed[1] !== postId) continue;
    const number = Number(parsed[2]);
    if (!tracks.has(number)) tracks.set(number, match[0]);
  }

  const categories: NamedLink[] = [];
  const tags: NamedLink[] = [];
  $('div.tags a.label').each((_, element) => {
    const link = $(element);
    const href = link.attr('href');
    const name = link.text().trim();
    const category = slugOf(href, HASMR_SITE, 'category');
    const tag = slugOf(href, HASMR_SITE, 'tag');
    if (category && name) categories.push({ slug: category, name });
    else if (tag && name) tags.push({ slug: tag, name });
  });

  const actors: NamedLink[] = [];
  $('#video-actors a[href]').each((_, element) => {
    const link = $(element);
    const slug = slugOf(link.attr('href'), HASMR_SITE, 'actor');
    const name = link.text().trim();
    if (slug && name) actors.push({ slug, name });
  });

  const rawTitle = $('title').first().text();
  const title = rawTitle
    .replace(/\s+-\s+Hentai ASMR\s*$/i, '')
    .replace(/^\[RJ\d+\]\s*/i, '')
    .trim();

  const ogImage =
    $('meta[itemprop="thumbnailUrl"]').attr('content') ??
    $('meta[property="og:image"]').attr('content');
  const postFromAttr = $('article[data-post-id]').first().attr('data-post-id');

  return {
    postId: postId ?? postFromAttr ?? null,
    title: title || null,
    cover: imageUrl(ogImage, pageUrl),
    circle,
    voices,
    categories,
    tags,
    actors,
    durationSec: parseIsoDuration($('meta[itemprop="duration"]').attr('content')),
    tracks: [...tracks.entries()]
      .sort(([a], [b]) => a - b)
      .map(([number, url]) => ({ number, url })),
  };
}
