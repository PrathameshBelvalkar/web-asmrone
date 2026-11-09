import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Writes via a temp file in the same directory, then renames over the target.
 * A reader never sees a half-written file. `mode` applies to the file that ends up at `path`.
 * Callers that issue several writes to one path must serialise them (see Mutex).
 */
export async function writeFileAtomic(path: string, data: string, mode = 0o600): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, data, { encoding: 'utf8', mode });
  await rename(tmp, path);
}
