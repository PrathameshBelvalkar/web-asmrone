import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  ECHO_WEB_DATA: z.string().min(1).optional(),
  ECHO_WEB_DIST: z.string().min(1).optional(),
  JASMR_CRAWL_DELAY_MS: z.coerce.number().int().min(0).max(600_000).default(10_000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export interface AppConfig {
  readonly port: number;
  /** Always bound to loopback; the server is for one local user. */
  readonly host: '127.0.0.1';
  readonly dataDir: string;
  /** Built web UI served at `/`, or null when no build was found. */
  readonly distDir: string | null;
  /** Minimum gap between two japaneseasmr.com page requests (robots.txt asks for 10 s). */
  readonly jasmrCrawlDelayMs: number;
  readonly logLevel: z.infer<typeof envSchema>['LOG_LEVEL'];
}

/** Parses environment variables. Throws a readable error for invalid values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  const raw = parsed.data.ECHO_WEB_DATA;
  return {
    port: parsed.data.PORT,
    host: '127.0.0.1',
    dataDir: raw ? expandHome(raw) : join(homedir(), '.echo-web'),
    distDir: findDist(parsed.data.ECHO_WEB_DIST),
    jasmrCrawlDelayMs: parsed.data.JASMR_CRAWL_DELAY_MS,
    logLevel: parsed.data.LOG_LEVEL,
  };
}

/**
 * The built UI folder. An explicit `ECHO_WEB_DIST` is used as given (or ignored if it is not a
 * directory). Otherwise the first `frontend/dist` found beside this package, then one relative to
 * the working directory, as the Kotlin server does.
 */
export function findDist(explicit: string | undefined, cwd: string = process.cwd()): string | null {
  if (explicit !== undefined) {
    const path = resolve(expandHome(explicit));
    return isDirectory(path) ? path : null;
  }
  const candidates = [
    fileURLToPath(new URL('../../../frontend/dist', import.meta.url)),
    resolve(cwd, '../frontend/dist'),
    resolve(cwd, 'web/frontend/dist'),
  ];
  const found = candidates.find(isDirectory);
  return found ? resolve(found) : null;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function expandHome(path: string): string {
  return path === '~' || path.startsWith('~/') ? join(homedir(), path.slice(1)) : path;
}
