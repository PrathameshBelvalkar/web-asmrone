import type { MangaIndexKind, MangaTagKind } from '../../models/manga.js';

/** 3hentai.to source (Manga & Doujinshi). Used with the site's permission. */
export const THREEHENTAI_SITE = 'https://3hentai.to';
/** Page images, thumbnails and covers. They load without a Referer. */
export const THREEHENTAI_MEDIA = 'https://3-hentai.xyz';
export const THREEHENTAI_MEDIA_HOST = '3-hentai.xyz';
/** Sent with every request. Plain, honest identity; no browser impersonation. */
export const APP_USER_AGENT = 'EchoASMR/1.0';

/** Path segment of each kind's gallery list (`/tag/{slug}/`) and A–Z index (`/tags/`). */
export const KIND_PATH: Readonly<Record<MangaTagKind, string>> = {
  tag: 'tag',
  artist: 'artist',
  character: 'character',
  parody: 'parody',
  group: 'group',
  language: 'language',
  category: 'category',
};
export const INDEX_PATH: Readonly<Record<MangaIndexKind, string>> = {
  tag: 'tags',
  artist: 'artists',
  character: 'characters',
  parody: 'parodies',
  group: 'groups',
};

/** File type letter in the gallery JSON → file extension. */
export const IMAGE_EXT: Readonly<Record<string, string>> = { j: 'jpg', w: 'webp', p: 'png', g: 'gif' };
