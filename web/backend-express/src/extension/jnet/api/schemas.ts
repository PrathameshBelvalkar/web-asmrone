import { z } from 'zod';

/** Titles and descriptions come in five languages. Any of them can be empty or missing. */
export const localizedSchema = z.looseObject({
  english: z.string().nullish(),
  japanese: z.string().nullish(),
  chinese: z.string().nullish(),
  korean: z.string().nullish(),
  spanish: z.string().nullish(),
});
export type Localized = z.infer<typeof localizedSchema>;

/**
 * Some fields arrive as JSON text inside JSON (`"tags": "[{...}]"`). Parse them; anything that
 * doesn't parse becomes null instead of failing the whole page.
 */
export function parseJsonField(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value.trim() === '') return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export const workTagSchema = z.looseObject({
  english: z.string().nullish(),
  japanese: z.string().nullish(),
});

export const circleSchema = z.looseObject({
  romaji: z.string().nullish(),
  kana: z.string().nullish(),
});

/** A work in a list: search results, home buckets and related works. */
export const workSummarySchema = z.looseObject({
  id: z.number(),
  rjCode: z.string(),
  image: z.string().nullish(),
  /** `"2:47:25"` in search results, whole seconds on the home screen. */
  duration: z.union([z.string(), z.number()]).nullish(),
  subtitled: z.boolean().nullish(),
  title: localizedSchema.nullish(),
  circle: z.preprocess(parseJsonField, circleSchema.nullish()),
  tags: z.preprocess(parseJsonField, z.array(workTagSchema).nullish()),
  views: z.number().nullish(),
  likes: z.number().nullish(),
});
export type WorkSummary = z.infer<typeof workSummarySchema>;
export type WorkTag = z.infer<typeof workTagSchema>;

/** One track of a work. `length` is in whole seconds. */
const trackSchema = z.looseObject({
  title: localizedSchema.nullish(),
  length: z.number(),
});

/** A full work from `/api/v1/videos?code=`. */
export const videoSchema = z.looseObject({
  id: z.number(),
  rjCode: z.string(),
  type: z.string().nullish(),
  duration: z.string().nullish(),
  thumbnail: z.string().nullish(),
  likes: z.number().nullish(),
  title: localizedSchema,
  description: localizedSchema.nullish(),
  circle: z.preprocess(parseJsonField, circleSchema.nullish()),
  tags: z.preprocess(parseJsonField, z.array(workTagSchema).nullish()),
  tracks: z.preprocess(parseJsonField, z.array(trackSchema).nullish()),
  /** Path of the single audio file that holds the whole work, e.g. `/media/audio/RJ….m4a`. */
  source: z.string().nullish(),
  subtitled: z.boolean().nullish(),
  related: z.array(workSummarySchema).nullish(),
});
export type Video = z.infer<typeof videoSchema>;

export const searchSchema = z.looseObject({
  results: z.array(workSummarySchema),
  totalCount: z.number(),
});
export type Search = z.infer<typeof searchSchema>;

export const homeSchema = z.looseObject({
  buckets: z.array(
    z.looseObject({
      key: z.string(),
      title: z.string(),
      videos: z.array(workSummarySchema),
    }),
  ),
});
export type Home = z.infer<typeof homeSchema>;

export const tagsSchema = z.array(
  z.looseObject({
    id: z.number(),
    name: localizedSchema,
    videoCount: z.number().nullish(),
    explicit: z.boolean().nullish(),
    type: z.string().nullish(),
  }),
);
export type Tag = z.infer<typeof tagsSchema>[number];
