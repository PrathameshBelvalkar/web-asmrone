import { readFile, rm } from 'node:fs/promises';
import { z } from 'zod';
import { writeFileAtomic } from '../lib/atomic-file.js';

/** Wire-format user as stored in `user.json` (same layout as the Kotlin server). */
export const storedUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  cover: z.unknown().nullish(),
  subtitle: z.string().nullish(),
  extras: z.record(z.string(), z.string()).default({}),
});

export type StoredUser = z.infer<typeof storedUserSchema>;

/** The single logged-in user. The asmr.one token lives in `extras.token`. */
export class UserRepository {
  constructor(private readonly file: string) {}

  /** Returns the saved user, or null when none is saved or the file is unreadable. */
  async load(): Promise<StoredUser | null> {
    try {
      const parsed = storedUserSchema.safeParse(JSON.parse(await readFile(this.file, 'utf8')));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  /** Saves the wire-format user (see the user view). */
  async save(user: Record<string, unknown>): Promise<void> {
    await writeFileAtomic(this.file, JSON.stringify(user));
  }

  async clear(): Promise<void> {
    await rm(this.file, { force: true });
  }
}
