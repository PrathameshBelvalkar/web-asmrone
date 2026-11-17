import { BLOCKED_WORD } from '../../lib/content-rules.js';

export { APP_USER_AGENT } from '../hasmr/constants.js';

export const HANIME_SITE = 'https://hanime.tv';
/** The whole catalog in one answer (`window.AppConfig.search_hvs_url` on the site). */
export const HANIME_CATALOG_URL = 'https://guest.freeanimehentai.net/api/v11/search_hvs';
export const HANIME_SITEMAP_URL = `${HANIME_SITE}/sitemap.xml.gz`;
/** Hosts the catalog address may move to. A new address found on the home page must be on one. */
export const HANIME_CATALOG_HOSTS: readonly string[] = ['guest.freeanimehentai.net', 'hanime.tv'];
/** Posters and covers. The browser loads them directly; the proxy serves them as a fallback. */
export const HANIME_IMAGE_PREFIX = 'https://hanime-cdn.com/images/';

export const titleUrl = (slug: string): string => `${HANIME_SITE}/videos/hentai/${slug}`;

/**
 * Content rule: these series present their characters as children (the "LO" magazine titles,
 * Kodomo no Jikan, Gaki ni Modotte). They are matched by name in every language the site gives and
 * are never listed. This is a fixed list, not a setting. Other titles are not filtered by words in
 * their names: across five languages that blocked many unrelated titles (エロリーマン, "Adventure Kid").
 */
export const BLOCKED_SERIES =
  /kodomo no jikan|こどもの時間|\blo re\b|lolipaco|gaki ni modotte|ガキにもどって|ガ○にもどって/i;

/** Content rule: a tag naming a blocked kind (`loli`, `shota`, `toddler`). The site has none today. */
export const isBlockedTag = (tag: string): boolean => BLOCKED_WORD.test(tag);

/** The site's tags, grouped for the Tags page and the filter sheet. Tags not listed go into Other. */
export const TAG_GROUPS: readonly { readonly group: string; readonly tags: readonly string[] }[] = [
  {
    group: 'Format',
    tags: ['hd', 'censored', 'uncensored', '3d', 'filmed', 'pov', 'x-ray', 'softcore'],
  },
  {
    group: 'Story',
    tags: [
      'plot',
      'comedy',
      'horror',
      'fantasy',
      'vanilla',
      'harem',
      'ntr',
      'incest',
      'mind break',
      'mind control',
    ],
  },
  {
    group: 'Characters',
    tags: [
      'school girl',
      'milf',
      'teacher',
      'nurse',
      'maid',
      'glasses',
      'dark skin',
      'nekomimi',
      'tsundere',
      'futanari',
      'trap',
      'monster',
      'ugly bastard',
      '2000-year-old dragon girl',
      'big boobs',
      'pregnant',
    ],
  },
  { group: 'Pairing', tags: ['yuri', 'yaoi', 'threesome', 'orgy', 'gangbang', 'virgin'] },
  {
    group: 'Acts',
    tags: [
      'blow job',
      'boob job',
      'hand job',
      'foot job',
      'rimjob',
      'anal',
      'creampie',
      'facial',
      'masturbation',
      'public sex',
      'lactation',
      'ahegao',
    ],
  },
  {
    group: 'Fetish',
    tags: [
      'bondage',
      'bdsm',
      'toys',
      'tentacle',
      'cosplay',
      'swimsuit',
      'watersports',
      'scat',
      'inflation',
    ],
  },
];
export const OTHER_TAG_GROUP = 'Other';

/** Format tags aren't used for Home's tag shelves or for "similar". */
export const FORMAT_TAGS: ReadonlySet<string> = new Set(TAG_GROUPS[0]?.tags ?? []);

/** `blow job` → `blow-job`; `Pink Pineapple` → `pink-pineapple`. */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
