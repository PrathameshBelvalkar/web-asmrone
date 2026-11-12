import { cpSync, existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Brings data over from the web version (`~/.echo-web`) on the first run of the desktop app.
 * Runs only when the new data folder has no settings yet. The old folder is never deleted.
 */
export function migrate(dataDir: string, home: string): { copied: boolean; movedModels: number } {
  const oldDir = join(home, '.echo-web');
  if (existsSync(join(dataDir, 'settings.json')) || !existsSync(oldDir)) {
    return { copied: false, movedModels: 0 };
  }
  mkdirSync(dataDir, { recursive: true });
  for (const name of ['settings.json', 'user.json', 'ai-subtitles']) {
    const source = join(oldDir, name);
    if (existsSync(source)) cpSync(source, join(dataDir, name), { recursive: true });
  }

  // Models are large, so they are moved rather than copied. A file that cannot be moved stays put.
  let movedModels = 0;
  const oldModels = join(oldDir, 'models');
  const newModels = join(dataDir, 'models');
  if (existsSync(oldModels)) {
    mkdirSync(newModels, { recursive: true });
    for (const name of readdirSync(oldModels)) {
      try {
        renameSync(join(oldModels, name), join(newModels, name));
        movedModels++;
      } catch {
        // Left in the old folder; the user can still copy it by hand.
      }
    }
  }
  return { copied: true, movedModels };
}
