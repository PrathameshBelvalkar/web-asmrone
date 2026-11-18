import { load } from 'cheerio';
import { HENTAIBROS_SITE, POST_SLUG } from './constants.js';

/** The post sitemaps (`post-sitemap.xml`, `post-sitemap2.xml`, …) the sitemap index lists. */
export function postSitemapsOf(indexXml: string): string[] {
  return [...indexXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
    .map((m) => m[1] as string)
    .filter((url) => /^https:\/\/hentaibros\.net\/post-sitemap\d*\.xml$/.test(url));
}

/** The post slugs a post sitemap lists; the home page and anything not a plain slug are left out. */
export function postSlugsOf(sitemapXml: string): string[] {
  const prefix = `${HENTAIBROS_SITE}/`;
  return [...sitemapXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
    .map((m) => m[1] as string)
    .filter((url) => url.startsWith(prefix))
    .map((url) => url.slice(prefix.length).replace(/\/$/, ''))
    .filter((slug) => POST_SLUG.test(slug));
}

export interface EpisodeVideo {
  /** The page's heading: `Can Can Bunny episode 2`. */
  readonly title: string;
  /** The MP4 the player plays, with spaces and other unsafe characters escaped. */
  readonly file: string;
}

/**
 * The player's video. The page's FV Player box carries it as JSON in `data-item`:
 * `{"sources":[{"src":"https://cdn.vintageporno.stream/Can%20Can%20Bunny%2002%20Sub.mp4",…}]}`.
 * Only an https MP4 or HLS address is taken. Null when the page has no player.
 */
export function episodeVideoOf(html: string): EpisodeVideo | null {
  const $ = load(html);
  const title = $('h1').first().text().replace(/\s+/g, ' ').trim();
  for (const el of $('[data-item]').toArray()) {
    let item: unknown;
    try {
      item = JSON.parse($(el).attr('data-item') ?? '');
    } catch {
      continue;
    }
    const sources = (item as { sources?: unknown }).sources;
    if (!Array.isArray(sources)) continue;
    for (const source of sources as { src?: unknown }[]) {
      const file = videoAddress(source.src);
      if (file !== null) return { title, file };
    }
  }
  return null;
}

function videoAddress(src: unknown): string | null {
  if (typeof src !== 'string') return null;
  let url: URL;
  try {
    // `new URL` escapes the spaces some addresses have (`/1Ldk 08 Sub.mp4`).
    url = new URL(src);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !/\.(mp4|m3u8)$/i.test(url.pathname)) return null;
  return url.href;
}
