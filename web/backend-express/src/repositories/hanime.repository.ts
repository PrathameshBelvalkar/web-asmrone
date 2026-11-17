import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { writeFileAtomic } from '../lib/atomic-file.js';
import { Mutex } from '../lib/mutex.js';
import type { HanimeChange, HanimeRecord } from '../models/hanime.js';

const refSchema = z.object({ slug: z.string(), name: z.string() });
const recordSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  altTitles: z.array(z.string()),
  searchText: z.string(),
  description: z.array(z.string()),
  poster: z.string(),
  cover: z.string(),
  studio: refSchema,
  tags: z.array(z.string()),
  releasedAt: z.string(),
  uploadedAt: z.string(),
  views: z.number(),
  likes: z.number(),
  dislikes: z.number(),
  downloads: z.number(),
});

const catalogFileSchema = z.object({
  fetchedAt: z.string(),
  hash: z.string(),
  titles: z.array(recordSchema),
  blocked: z.array(z.string()).default([]),
});
export type CatalogFile = z.infer<typeof catalogFileSchema>;

const changeSchema = z.object({
  at: z.string(),
  kind: z.enum(['added', 'updated', 'removed']),
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  poster: z.string(),
  fields: z.array(z.string()).optional(),
});

/** Views by title id, one map per day (`YYYY-MM-DD`). */
const viewsFileSchema = z.object({ days: z.record(z.string(), z.record(z.string(), z.number())) });
export type ViewsFile = z.infer<typeof viewsFileSchema>;

const stateSchema = z.object({
  lastCheckedAt: z.string().nullable().default(null),
  lastChangedAt: z.string().nullable().default(null),
  lastError: z.string().nullable().default(null),
  lastSitemapAt: z.string().nullable().default(null),
  lastTagArtAt: z.string().nullable().default(null),
  /** Set when the catalog moved and the new address was found on the home page. */
  catalogUrl: z.string().nullable().default(null),
});
export type HanimeState = z.infer<typeof stateSchema>;

/** The Browse page's tag descriptions and pictures, by tag name. */
const tagArtSchema = z.record(
  z.string(),
  z.object({ description: z.string(), image: z.string().nullable() }),
);
export type TagArtFile = z.infer<typeof tagArtSchema>;

export const MAX_CHANGES = 500;
export const VIEW_DAYS = 14;

/**
 * The Hanime files in `<dataDir>/hanime/` (docs/HANIME.md, section 4.1). A missing or unreadable
 * file reads as empty. Writes are atomic and one at a time.
 */
export class HanimeRepository {
  private readonly gate = new Mutex();

  constructor(private readonly dir: string) {}

  readCatalog(): Promise<CatalogFile | null> {
    return this.read('catalog.json', catalogFileSchema);
  }

  async readChanges(): Promise<HanimeChange[]> {
    return (await this.read('changes.json', z.array(changeSchema))) ?? [];
  }

  async readViews(): Promise<ViewsFile> {
    return (await this.read('views.json', viewsFileSchema)) ?? { days: {} };
  }

  async readState(): Promise<HanimeState> {
    return (await this.read('state.json', stateSchema)) ?? stateSchema.parse({});
  }

  writeCatalog(file: {
    readonly fetchedAt: string;
    readonly hash: string;
    readonly titles: readonly HanimeRecord[];
    readonly blocked: readonly string[];
  }): Promise<void> {
    return this.write('catalog.json', file);
  }

  /** Keeps the newest MAX_CHANGES, newest first. */
  writeChanges(changes: readonly HanimeChange[]): Promise<void> {
    return this.write('changes.json', changes.slice(0, MAX_CHANGES));
  }

  /** Keeps the newest VIEW_DAYS days. */
  writeViews(views: ViewsFile): Promise<void> {
    const days = Object.keys(views.days).sort().slice(-VIEW_DAYS);
    return this.write('views.json', {
      days: Object.fromEntries(days.map((d) => [d, views.days[d]])),
    });
  }

  async readTagArt(): Promise<TagArtFile> {
    return (await this.read('tags.json', tagArtSchema)) ?? {};
  }

  writeTagArt(art: TagArtFile): Promise<void> {
    return this.write('tags.json', art);
  }

  writeState(state: HanimeState): Promise<void> {
    return this.write('state.json', state);
  }

  private async read<T>(name: string, schema: z.ZodType<T>): Promise<T | null> {
    try {
      const parsed = schema.safeParse(JSON.parse(await readFile(join(this.dir, name), 'utf8')));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private write(name: string, value: unknown): Promise<void> {
    return this.gate.run(() => writeFileAtomic(join(this.dir, name), JSON.stringify(value)));
  }
}
