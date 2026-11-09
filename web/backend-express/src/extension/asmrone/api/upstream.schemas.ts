/**
 * Upstream asmr.one payloads. Required fields match the Kotlin models (Models.kt); unknown
 * fields are dropped, as with `ignoreUnknownKeys`. Parse failures surface as errors.
 */
import { z } from 'zod';
import type { FolderNode, MediaNode } from '../media-tree/tree.js';
import { folder } from '../media-tree/tree.js';

export const paginationSchema = z
  .object({
    currentPage: z.number().int().optional(),
    page: z.number().int().optional(),
    pageSize: z.number().int(),
    totalCount: z.number().int(),
  })
  .transform((p, ctx) => {
    const currentPage = p.currentPage ?? p.page;
    if (currentPage === undefined) {
      ctx.addIssue({ code: 'custom', message: 'currentPage is required' });
      return z.NEVER;
    }
    return { currentPage, pageSize: p.pageSize, totalCount: p.totalCount };
  });
export type Pagination = z.infer<typeof paginationSchema>;

const languageSchema = z.object({
  name: z.string().nullish(),
});

export const tagSchema = z.object({
  id: z.number().int(),
  i18n: z.object({
    'en-us': languageSchema,
    'ja-jp': languageSchema,
    'zh-cn': languageSchema,
  }),
  name: z.string(),
});
export type Tag = z.infer<typeof tagSchema>;

const languageEditionsSchema = z
  .unknown()
  .transform((value) => {
    if (Array.isArray(value)) return value as unknown[];
    if (value !== null && typeof value === 'object') return Object.values(value) as unknown[];
    return [] as unknown[];
  });

export const workSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  circle_id: z.number().int(),
  name: z.string(),
  nsfw: z.boolean(),
  release: z.string(),
  dl_count: z.number(),
  price: z.number(),
  review_count: z.number(),
  rate_count: z.number(),
  rate_average_2dp: z.number(),
  rate_count_detail: z.array(z.unknown()),
  rank: z.array(z.unknown()).nullish(),
  has_subtitle: z.boolean(),
  create_date: z.string(),
  vas: z.array(z.object({ id: z.string(), name: z.string() })),
  tags: z.array(tagSchema),
  language_editions: languageEditionsSchema,
  original_workno: z.string().nullish(),
  other_language_editions_in_db: z.array(z.unknown()),
  translation_info: z.looseObject({ lang: z.string().nullish() }),
  work_attributes: z.string(),
  age_category_string: z.string(),
  duration: z.number(),
  source_type: z.string(),
  source_id: z.string(),
  source_url: z.string(),
  userRating: z.number().int().nullish(),
  circle: z.object({
    id: z.number().int(),
    name: z.string(),
    source_id: z.string(),
    source_type: z.string(),
  }),
  samCoverUrl: z.string(),
  thumbnailCoverUrl: z.string(),
  mainCoverUrl: z.string(),
});
export type Work = z.infer<typeof workSchema>;

export const worksResponseSchema = z.object({
  works: z.array(workSchema),
  pagination: paginationSchema,
});
export type WorksResponse = z.infer<typeof worksResponseSchema>;

export const asmrPlaylistSchema = z.object({
  id: z.string(),
  user_name: z.string(),
  privacy: z.number().int(),
  locale: z.string(),
  playback_count: z.number().int(),
  name: z.string(),
  description: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  works_count: z.number().int(),
  latestWorkID: z.number().int().nullish(),
  mainCoverUrl: z.string(),
});
export type AsmrPlaylist = z.infer<typeof asmrPlaylistSchema>;

export const playlistsResponseSchema = z.object({
  playlists: z.array(asmrPlaylistSchema),
  pagination: paginationSchema,
});

export const upstreamUserSchema = z.object({
  loggedIn: z.boolean(),
  name: z.string(),
  group: z.string(),
  email: z.string().nullish(),
  recommenderUuid: z.string(),
});

export const loginResponseSchema = z.object({
  user: upstreamUserSchema,
  token: z.string(),
});

const fileWork = z.object({ id: z.number().int(), source_id: z.string(), source_type: z.string() });
const fileCommon = {
  title: z.string(),
  hash: z.string(),
  work: fileWork,
  workTitle: z.string(),
  mediaStreamUrl: z.string(),
  mediaDownloadUrl: z.string(),
  size: z.number(),
};

interface RawFile {
  title: string;
  hash: string;
  work: { id: number; source_id: string; source_type: string };
  workTitle: string;
  mediaStreamUrl: string;
  mediaDownloadUrl: string;
  size: number;
}

/** Media tree node as sent by the API. Unknown `type` values are rejected, as in Kotlin. */
type RawNode =
  | { type: 'folder'; title: string; children: RawNode[] }
  | ({ type: 'audio'; streamLowQualityUrl?: string | null; duration: number } & RawFile)
  | ({ type: 'text'; duration?: number | null } & RawFile)
  | ({ type: 'image' } & RawFile)
  | ({ type: 'other' } & RawFile);

export const rawNodeSchema: z.ZodType<RawNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('folder'), title: z.string(), children: z.array(rawNodeSchema) }),
    z.object({
      type: z.literal('audio'),
      ...fileCommon,
      streamLowQualityUrl: z.string().nullish(),
      duration: z.number(),
    }),
    z.object({ type: z.literal('text'), ...fileCommon, duration: z.number().nullish() }),
    z.object({ type: z.literal('image'), ...fileCommon }),
    z.object({ type: z.literal('other'), ...fileCommon }),
  ]),
);

/** Converts a raw node into the mutable tree model. Titles start untranslated. */
export function toMediaNode(raw: RawNode): MediaNode {
  if (raw.type === 'folder') return folder(raw.title, raw.children.map(toMediaNode));
  const file = {
    title: raw.title,
    untranslatedTitle: raw.title,
    hash: raw.hash,
    work: raw.work,
    workTitle: raw.workTitle,
    mediaStreamUrl: raw.mediaStreamUrl,
    mediaDownloadUrl: raw.mediaDownloadUrl,
    size: raw.size,
  };
  switch (raw.type) {
    case 'audio':
      return { ...file, type: 'audio', streamLowQualityUrl: raw.streamLowQualityUrl ?? null, duration: raw.duration };
    case 'text':
      return { ...file, type: 'text', duration: raw.duration ?? null };
    case 'image':
      return { ...file, type: 'image' };
    case 'other':
      return { ...file, type: 'other' };
  }
}

export function toRootFolder(nodes: RawNode[]): FolderNode {
  return folder('root', nodes.map(toMediaNode));
}
