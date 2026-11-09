import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** A fresh temporary directory for one test. Remove it with `cleanup`. */
export async function tempDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'echo-web-test-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
