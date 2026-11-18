import * as cheerio from 'cheerio';
import type { HanimeDetails, HanimeStoryboard } from '../../models/hanime.js';
import { HANIME_IMAGE_PREFIX } from './constants.js';

/** Only the site's own image host is passed on. */
const image = (url: string | undefined): string | null =>
  url !== undefined && url.startsWith(HANIME_IMAGE_PREFIX) ? url : null;

/** A section's content, found by its `h2` heading. */
function section($: cheerio.CheerioAPI, heading: string) {
  const h2 = $('h2')
    .filter((_, el) => $(el).text().trim() === heading)
    .first();
  return h2.length === 0 ? null : h2.closest('section');
}

/**
 * A title's page (`/videos/hentai/{slug}`): the storyboard the Preview frames come from (in the
 * player's props), the length (JSON-LD), the badges (`FHD 1080p`, `23 min`, `Sub EN`), the other
 * names and the synopsis. Any part the page lacks is left empty.
 */
export function parseTitlePage(html: string): HanimeDetails {
  const $ = cheerio.load(html);
  let storyboard: HanimeStoryboard | null = null;
  $('astro-island[props]').each((_, el) => {
    if (storyboard !== null) return;
    try {
      const props = JSON.parse($(el).attr('props') ?? '{}') as Record<
        string,
        [number, unknown] | undefined
      >;
      const url = image(
        typeof props.storyboard_url?.[1] === 'string' ? props.storyboard_url[1] : undefined,
      );
      const columns = Number(props.storyboard_columns?.[1]);
      const rows = Number(props.storyboard_rows?.[1]);
      const tiles = Number(props.storyboard_tile_count?.[1]);
      if (url !== null && columns > 0 && rows > 0 && tiles > 0 && tiles <= columns * rows) {
        storyboard = { url, columns, rows, tiles };
      }
    } catch {
      // Props that aren't JSON belong to some other component.
    }
  });

  let durationSec: number | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    const match = /"duration"\s*:\s*"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"/.exec($(el).text());
    if (match && durationSec === null) {
      durationSec =
        Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
    }
  });

  const badges = [
    ...new Set(
      $('span.badge')
        .toArray()
        .map((el) => $(el).text().replace(/\s+/g, ' ').trim())
        .filter((t) =>
          /^(?:(?:U|F)?HD|SD|4K)\b|^\d{3,4}p$|^\d+ min$|^(?:Sub|Dub) [A-Z]{2}$/i.test(t),
        ),
    ),
  ];

  const names = section($, 'Alternate Names');
  const altNames =
    names === null
      ? []
      : names
          .find('h3')
          .toArray()
          .map((el) => $(el).text().replace(/\s+/g, ' ').trim())
          .filter((t) => t !== '');

  const story = section($, 'Synopsis');
  const synopsis =
    story === null
      ? []
      : story
          .find('p')
          .toArray()
          .map((el) => $(el).text().replace(/\s+/g, ' ').trim())
          .filter((t) => t !== '' && t !== 'Show More');

  return { durationSec, badges, altNames, synopsis, storyboard };
}

export interface TagArt {
  readonly description: string;
  readonly image: string | null;
}

/** The Browse page's tag cards: a one-line description and a tall picture, by tag name (lower case). */
export function parseBrowseTags(html: string): Map<string, TagArt> {
  const $ = cheerio.load(html);
  const out = new Map<string, TagArt>();
  $('a[href^="/browse/tags/"]').each((_, el) => {
    const card = $(el);
    const title = card.find('.tile-title').text().trim().toLowerCase();
    if (title === '' || out.has(title)) return;
    const style = card.find('.tile-icon').attr('style') ?? '';
    const art = /url\(['"]?([^'")]+)['"]?\)/.exec(style)?.[1];
    out.set(title, {
      description: card.find('.tile-description').text().replace(/\s+/g, ' ').trim(),
      image: image(art),
    });
  });
  return out;
}
