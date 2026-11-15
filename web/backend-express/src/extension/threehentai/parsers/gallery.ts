import { load } from 'cheerio';
import { z } from 'zod';
import type { MangaGallery, MangaPage, MangaTag } from '../../../models/manga.js';
import { isMangaTagKind } from '../../../models/manga.js';
import { coverUrl, extOf, isoFromUnix, pageUrl, thumbUrl } from '../mappers.js';
import { mediaUrl, parseQty, tagLinkOf } from './common.js';

const imageSchema = z.object({ t: z.string(), w: z.number().nullish(), h: z.number().nullish() });

/** The `gallery` object a reader page passes to `new N.reader({...})`. */
const readerGallerySchema = z.object({
  id: z.union([z.number(), z.string()]),
  media_id: z.union([z.number(), z.string()]),
  title: z.object({
    english: z.string().nullish(),
    japanese: z.string().nullish(),
    pretty: z.string().nullish(),
  }),
  images: z.object({
    pages: z.array(imageSchema),
    cover: imageSchema.nullish(),
    thumbnail: imageSchema.nullish(),
  }),
  scanlator: z.string().nullish(),
  upload_date: z.number().nullish(),
  tags: z
    .array(
      z.object({
        id: z.number(),
        type: z.string(),
        name: z.string(),
        url: z.string().nullish(),
        books_count: z.number().nullish(),
      }),
    )
    .default([]),
  num_pages: z.number().nullish(),
});

/**
 * A gallery from its reader page (`/d/{id}/{page}/`). The page embeds the whole gallery as JSON,
 * so one request gives every page's address and size. Returns null when the JSON isn't there.
 */
export function parseReaderPage(html: string): MangaGallery | null {
  const raw = readerJson(html);
  if (raw === null) return null;
  const parsed = readerGallerySchema.safeParse(raw);
  if (!parsed.success) return null;
  const g = parsed.data;
  const mediaId = String(g.media_id);
  if (!/^\d+$/.test(mediaId)) return null;
  const pages: MangaPage[] = g.images.pages.map((p, i) => {
    const ext = extOf(p.t);
    return {
      n: i + 1,
      url: pageUrl(mediaId, i + 1, ext),
      thumb: thumbUrl(mediaId, i + 1, ext),
      width: p.w ?? null,
      height: p.h ?? null,
    };
  });
  const tags: MangaTag[] = [];
  for (const t of g.tags) {
    const link = tagLinkOf(t.url ?? undefined);
    const kind = link?.kind ?? (isMangaTagKind(t.type) ? t.type : null);
    if (kind === null) continue;
    tags.push({
      kind,
      slug: link?.slug ?? t.name.toLowerCase().replace(/\s+/g, '-'),
      name: t.name,
      count: t.books_count ?? null,
      id: t.id,
    });
  }
  const title = g.title.english?.trim() || g.title.pretty?.trim() || `#${String(g.id)}`;
  return {
    id: String(g.id),
    title,
    titleJapanese: g.title.japanese?.trim() || null,
    prettyTitle: g.title.pretty?.trim() || null,
    cover: coverUrl(mediaId, extOf(g.images.cover?.t ?? g.images.pages[0]?.t)),
    pages,
    tags,
    uploadedAt: isoFromUnix(g.upload_date),
    scanlator: g.scanlator?.trim() || null,
  };
}

/** Finds `gallery: {...}` inside the `N.reader(` call and parses it, or null. */
function readerJson(html: string): unknown {
  const call = html.indexOf('N.reader(');
  if (call < 0) return null;
  const key = html.indexOf('gallery:', call);
  if (key < 0) return null;
  const start = html.indexOf('{', key);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const GROUP_KIND: Readonly<Record<string, MangaTag['kind']>> = {
  tags: 'tag',
  artists: 'artist',
  characters: 'character',
  parodies: 'parody',
  groups: 'group',
  languages: 'language',
  categories: 'category',
};

/**
 * Fallback: a gallery from its info page (`/d/{id}/`), for when the reader JSON can't be read.
 * Page addresses come from the thumbnails (`{n}t.{ext}` → `{n}.{ext}`). Tag ids aren't on this
 * page, so the content rules match these tags by name.
 */
export function parseGalleryPage(html: string, id: string): MangaGallery | null {
  const $ = load(html);
  const info = $('#main-info');
  if (info.length === 0) return null;
  const tags: MangaTag[] = [];
  let uploadedAt: string | null = null;
  info.find('.tag-container').each((_, element) => {
    const box = $(element);
    const label = (box.contents().first().text() || '').trim().replace(/:$/, '').toLowerCase();
    if (label === 'uploaded') uploadedAt = box.find('time').attr('datetime') ?? null;
    const kind = GROUP_KIND[label];
    if (kind === undefined) return;
    box.find('a.name[href]').each((_, a) => {
      const link = tagLinkOf($(a).attr('href'));
      if (link === null) return;
      tags.push({ kind, slug: link.slug, name: $(a).text().trim(), count: parseQty($(a).attr('data-qty')), id: null });
    });
  });
  const pages: MangaPage[] = [];
  $('#thumbnail-gallery img').each((i, element) => {
    const img = $(element);
    const thumb = mediaUrl(img.attr('data-src') ?? img.attr('src'));
    if (thumb === null) return;
    const width = Number(img.attr('width'));
    const height = Number(img.attr('height'));
    pages.push({
      n: i + 1,
      url: thumb.replace(/\/(\d+)t\.([a-z]+)$/, '/$1.$2'),
      thumb,
      width: Number.isFinite(width) && width > 0 ? width : null,
      height: Number.isFinite(height) && height > 0 ? height : null,
    });
  });
  const cover = mediaUrl($('meta[property="og:image"]').attr('content')) ?? pages[0]?.thumb;
  if (cover === undefined) return null;
  const title = info.find('h1').first().text().trim() || `#${id}`;
  return {
    id,
    title,
    titleJapanese: info.find('.middle-title').first().text().trim() || null,
    prettyTitle: null,
    cover,
    pages,
    tags,
    uploadedAt,
    scanlator: null,
  };
}
