import { z } from 'zod';

/** Numbers sometimes arrive as strings; both are accepted. */
const count = z.coerce.number().int().min(0).catch(0);

/** One title in the catalog answer (`search_hvs`). Unknown fields are ignored. */
export const rawTitleSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().min(1),
  search_titles: z.string().catch(''),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/i),
  description: z
    .string()
    .nullish()
    .transform((v) => v ?? ''),
  views: count,
  cover_url: z.url(),
  poster_url: z.url(),
  brand: z
    .string()
    .nullish()
    .transform((v) => v ?? ''),
  brand_id: z.coerce.number().int().catch(0),
  likes: count,
  dislikes: count,
  downloads: count,
  tags: z.array(z.string()).catch([]),
  created_at_unix: z.coerce.number().int(),
  released_at_unix: z.coerce.number().int(),
});
export type RawTitle = z.infer<typeof rawTitleSchema>;

/** The answer's outer shape. Each title is checked on its own, so one bad title doesn't sink the rest. */
export const catalogSchema = z.object({ data: z.array(z.unknown()) });
