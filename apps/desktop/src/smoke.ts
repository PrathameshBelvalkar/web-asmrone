import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AppPaths } from './paths';
import type { ServerHandle } from './server-process';

interface ToolsStatus {
  ffmpeg: { found: boolean };
  engine: { variants: string[] };
}

/** Each bundled program must start and print its help or version. */
function runProgram(path: string, args: string[]): void {
  execFileSync(path, args, { stdio: 'ignore', timeout: 20_000 });
}

/**
 * `--smoke-test`: starts the server, checks the bundled tools, and exits. Prints SMOKE OK, or the
 * reason it failed and exits with code 1. No window is created.
 */
export async function runSmoke(paths: AppPaths, server: ServerHandle): Promise<number> {
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/tools`);
    if (!res.ok) throw new Error(`/api/tools answered ${res.status}`);
    const status = (await res.json()) as ToolsStatus;
    if (!status.ffmpeg.found) throw new Error('FFmpeg was not found in the app.');
    if (status.engine.variants.length === 0) throw new Error('No subtitle engine was found in the app.');
    if (paths.binDir === undefined) throw new Error('No bundled tools folder.');

    const ffmpeg = join(paths.binDir, 'ffmpeg');
    if (!existsSync(ffmpeg)) throw new Error(`Missing ${ffmpeg}`);
    runProgram(ffmpeg, ['-version']);
    for (const variant of status.engine.variants) {
      if (variant === 'system') continue;
      runProgram(join(paths.binDir, 'whisper', variant, 'whisper-server'), ['--help']);
    }
    console.log('SMOKE OK');
    return 0;
  } catch (err) {
    console.error(`SMOKE FAILED: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  } finally {
    await server.stop();
  }
}
