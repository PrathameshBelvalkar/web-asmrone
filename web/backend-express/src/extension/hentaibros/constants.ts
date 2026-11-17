/** hentaibros.net: where a Hanime title's video plays from (docs/HANIME.md section 12). */
export const HENTAIBROS_SITE = 'https://hentaibros.net';
export const HENTAIBROS_SITEMAP_INDEX = `${HENTAIBROS_SITE}/sitemap_index.xml`;

/** An episode page's slug: lower-case words and dashes (`can-can-bunny-episode-2`). */
export const POST_SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/;

export const postUrl = (slug: string): string => `${HENTAIBROS_SITE}/${slug}/`;
