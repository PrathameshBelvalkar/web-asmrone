import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { appLogger } from '../lib/app-logger.js';
import { writeFileAtomic } from '../lib/atomic-file.js';
import type { TimedLine } from '../models/ai-subtitles.js';

const fileSchema = z.object({
  version: z.literal(1),
  trackId: z.string(),
  createdAt: z.string(),
  lines: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })),
});

/**
 * Generated subtitles, one JSON file per track (`<dir>/<sha1(trackId)>.json`). Lines are stored in
 * the spoken language; translation happens when they are read, so a language change still applies.
 */
export class AiSubtitleRepository {
  constructor(private readonly dir: string) {}

  /** The saved lines, or null when the track has none (or the file is unreadable). */
  async get(trackId: string): Promise<readonly TimedLine[] | null> {
    let text: string;
    try {
      text = await readFile(this.path(trackId), 'utf8');
    } catch {
      return null;
    }
    try {
      const parsed = fileSchema.parse(JSON.parse(text));
      return parsed.trackId === trackId ? parsed.lines : null;
    } catch (err) {
      appLogger().warn({ err, trackId }, 'ignoring unreadable AI subtitle file');
      return null;
    }
  }

  async put(trackId: string, lines: readonly TimedLine[]): Promise<void> {
    const data: z.infer<typeof fileSchema> = {
      version: 1,
      trackId,
      createdAt: new Date().toISOString(),
      lines: [...lines],
    };
    await writeFileAtomic(this.path(trackId), JSON.stringify(data), 0o644);
  }

  private path(trackId: string): string {
    return join(this.dir, `${createHash('sha1').update(trackId).digest('hex')}.json`);
  }
}
