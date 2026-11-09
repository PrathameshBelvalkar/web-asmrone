import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  ECHO_WEB_DATA: z.string().min(1).optional(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export interface AppConfig {
  readonly port: number;
  /** Always bound to loopback; the server is for one local user. */
  readonly host: '127.0.0.1';
  readonly dataDir: string;
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
    logLevel: parsed.data.LOG_LEVEL,
  };
}

function expandHome(path: string): string {
  return path === '~' || path.startsWith('~/') ? join(homedir(), path.slice(1)) : path;
}
