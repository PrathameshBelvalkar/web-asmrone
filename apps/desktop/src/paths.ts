import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where things live. Written as plain functions of their inputs so they can be tested without
 * Electron: `main.ts` supplies the values from `app` and `process`.
 */
export interface PathInput {
  readonly isPackaged: boolean;
  /** `process.resourcesPath` when packaged. */
  readonly resourcesPath: string;
  /** The desktop package folder (`apps/desktop`) in development. */
  readonly packageDir: string;
  /** `app.getPath('userData')`, unless ECHO_WEB_DATA overrides it. */
  readonly userData: string;
  readonly envDataDir?: string;
  readonly arch: string;
  readonly appVersion: string;
}

export interface AppPaths {
  readonly resources: string;
  readonly dataDir: string;
  readonly serverEntry: string;
  readonly uiDir: string;
  /** Bundled tools folder, or undefined in development when none was built. */
  readonly binDir: string | undefined;
  readonly logsDir: string;
  readonly licensesDir: string;
}

export function resolvePaths(input: PathInput, fileExists: (path: string) => boolean = existsSync): AppPaths {
  const resources = input.isPackaged ? input.resourcesPath : input.packageDir;
  const repoRoot = join(input.packageDir, '..', '..');
  const dataDir = input.envDataDir ?? input.userData;
  const devBin = join(input.packageDir, 'resources', 'bin', `mac-${input.arch}`);
  return {
    resources,
    dataDir,
    serverEntry: input.isPackaged
      ? join(resources, 'server', 'server.mjs')
      : join(repoRoot, 'web', 'backend-express', 'dist', 'server.js'),
    uiDir: input.isPackaged ? join(resources, 'ui') : join(repoRoot, 'web', 'frontend', 'dist'),
    binDir: input.isPackaged
      ? join(resources, 'bin')
      : fileExists(devBin)
        ? devBin
        : undefined,
    logsDir: join(dataDir, 'logs'),
    licensesDir: join(resources, 'licenses'),
  };
}

/** Environment for the server process. Port 0 asks the system for a free one. */
export function serverEnv(
  paths: AppPaths,
  input: PathInput,
  port: number,
  base: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...base,
    PORT: String(port),
    ECHO_WEB_DATA: paths.dataDir,
    ECHO_WEB_DIST: paths.uiDir,
    ECHO_DESKTOP_VERSION: input.appVersion,
    LOG_LEVEL: 'info',
  };
  // Only set when there is a bundled folder: a missing value would reach the server as "undefined".
  if (paths.binDir !== undefined) env.ECHO_BIN_DIR = paths.binDir;
  else delete env.ECHO_BIN_DIR;
  return env;
}
