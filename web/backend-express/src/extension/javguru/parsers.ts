import { load } from 'cheerio';
import { JAVGURU_SITE } from './constants.js';
import { unpack } from './packer.js';

/** A post's address on the site: `/{id}/{slug}/`. */
export const POST_PATH = /^\/\d{1,9}\/[a-z0-9%-]{1,400}\/$/i;

const decode = (html: string): string => load(`<p>${html}</p>`)('p').text();

/** A post found for a DVD ID. */
export interface FoundPost {
  readonly url: string;
  readonly title: string;
}

/**
 * The post for a DVD ID, from the REST search answer: the first post whose title starts with
 * `[DVD-ID]`. Null when none does.
 */
export function postFor(json: unknown, dvdId: string): FoundPost | null {
  if (!Array.isArray(json)) return null;
  const prefix = `[${dvdId.toUpperCase()}]`;
  for (const post of json as unknown[]) {
    if (typeof post !== 'object' || post === null) continue;
    const { link, title } = post as { link?: unknown; title?: { rendered?: unknown } };
    if (typeof link !== 'string' || typeof title?.rendered !== 'string') continue;
    const text = decode(title.rendered).trim();
    if (!text.toUpperCase().startsWith(prefix)) continue;
    try {
      const url = new URL(link);
      if (url.origin === JAVGURU_SITE && POST_PATH.test(url.pathname))
        return { url: url.href, title: text };
    } catch {
      // Not an address: try the next post.
    }
  }
  return null;
}

/** One stream button on a post: its label and the gateway address it opens. */
export interface ServerButton {
  readonly label: string;
  readonly gateway: URL;
}

/**
 * The stream buttons on a post. Each `a.wp-btn-iframe__shortcode` names, in `data-localize`, an
 * inline `var {name} = {…}` whose `iframe_url` is the gateway address in base64.
 */
export function serverButtons(html: string): ServerButton[] {
  const configs = new Map<string, string>();
  for (const match of html.matchAll(/var\s+(\w+)\s*=\s*(\{"btn_class".*?\});\s*$/gm)) {
    try {
      const config = JSON.parse(match[2] ?? '') as { iframe_url?: unknown };
      if (typeof config.iframe_url === 'string') configs.set(match[1] ?? '', config.iframe_url);
    } catch {
      // A config that isn't JSON: its button is skipped.
    }
  }
  const $ = load(html);
  const buttons: ServerButton[] = [];
  $('a.wp-btn-iframe__shortcode[data-localize]').each((_, el) => {
    const encoded = configs.get($(el).attr('data-localize') ?? '');
    if (encoded === undefined) return;
    try {
      const gateway = new URL(Buffer.from(encoded, 'base64').toString('utf8'));
      if (gateway.origin !== JAVGURU_SITE) return;
      buttons.push({ label: $(el).text().replace(/\s+/g, ' ').trim().toUpperCase(), gateway });
    } catch {
      // Not an address.
    }
  });
  return buttons;
}

/** Stream addresses an embed page offers, best first. */
export interface EmbedLinks {
  readonly masters: string[];
}

/**
 * The HLS master playlists in an embed page's packed player setup: `var links = {hls4, hls3, hls2}`.
 * `hls4` is on the embed host itself. `hls2` is next, and `hls3` (a `.txt` playlist) last. Null when
 * the page has no packed player, which is what the host answers without the right Referer.
 */
export function embedLinks(html: string, embedUrl: string): EmbedLinks | null {
  const source = unpack(html);
  if (source === null) return null;
  const raw = /var\s+links\s*=\s*(\{[^;]*?\})\s*;/.exec(source)?.[1];
  if (raw === undefined) return null;
  let links: Record<string, unknown>;
  try {
    links = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const masters: string[] = [];
  for (const key of ['hls4', 'hls2', 'hls3']) {
    const value = links[key];
    if (typeof value !== 'string' || value === '') continue;
    try {
      const url = new URL(value, embedUrl);
      if (url.protocol === 'https:') masters.push(url.href);
    } catch {
      // Not an address.
    }
  }
  return masters.length > 0 ? { masters } : null;
}
