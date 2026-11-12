import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(8080),
  ECHO_WEB_DATA: z.string().min(1).optional(),
  ECHO_WEB_DIST: z.string().min(1).optional(),
  JASMR_CRAWL_DELAY_MS: z.coerce.number().int().min(0).max(600_000).default(10_000),
  WHISPER_SERVER_BIN: z.string().min(1).default('whisper-server'),
  FFMPEG_BIN: z.string().min(1).default('ffmpeg'),
  WHISPER_MODEL: z.string().min(1).optional(),
  WHISPER_VAD_MODEL: z.string().min(1).optional(),
  /** Bundled tools folder (set by the desktop app). */
  ECHO_BIN_DIR: z.string().min(1).optional(),
  ECHO_BENCH_SAMPLE: z.string().min(1).optional(),
  ECHO_DESKTOP_VERSION: z.string().min(1).optional(),
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
  /** Local speech-to-text for tracks without lyrics. */
  readonly whisper: WhisperConfig;
  /** Bundled tools folder, null outside the desktop app. */
  readonly binDir: string | null;
  /** 16 kHz mono WAV used by the speed test. */
  readonly benchSample: string;
  /** Desktop app version, set only inside the desktop app. */
  readonly desktopVersion: string | null;
  /** Downloaded Whisper models. */
  readonly modelsDir: string;
}

export interface WhisperConfig {
  readonly whisperServerBin: string;
  readonly ffmpegBin: string;
  readonly model: string;
  /** Silero VAD model; used only when the file exists. */
  readonly vadModel: string;
}

/** Parses environment variables. Throws a readable error for invalid values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  const raw = parsed.data.ECHO_WEB_DATA;
  const dataDir = raw ? expandHome(raw) : join(homedir(), '.echo-web');
  const binDir = parsed.data.ECHO_BIN_DIR ? expandHome(parsed.data.ECHO_BIN_DIR) : null;
  return {
    port: parsed.data.PORT,
    host: '127.0.0.1',
    dataDir,
    distDir: findDist(parsed.data.ECHO_WEB_DIST),
    jasmrCrawlDelayMs: parsed.data.JASMR_CRAWL_DELAY_MS,
    logLevel: parsed.data.LOG_LEVEL,
    whisper: whisperConfig(parsed.data, dataDir),
    binDir,
    benchSample:
      parsed.data.ECHO_BENCH_SAMPLE ??
      (binDir
        ? join(binDir, 'samples', 'jfk.wav')
        : fileURLToPath(new URL('../../assets/benchmark.wav', import.meta.url))),
    desktopVersion: parsed.data.ECHO_DESKTOP_VERSION ?? null,
    modelsDir: join(dataDir, 'models'),
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

/** Binaries are looked up on PATH; models default to `<dataDir>/models` (see scripts/setup-whisper.sh). */
export function whisperConfig(
  env: Pick<z.infer<typeof envSchema>, 'WHISPER_SERVER_BIN' | 'FFMPEG_BIN' | 'WHISPER_MODEL' | 'WHISPER_VAD_MODEL'>,
  dataDir: string,
): WhisperConfig {
  const models = join(dataDir, 'models');
  return {
    whisperServerBin: expandHome(env.WHISPER_SERVER_BIN),
    ffmpegBin: expandHome(env.FFMPEG_BIN),
    model: env.WHISPER_MODEL ? expandHome(env.WHISPER_MODEL) : join(models, 'ggml-large-v3-turbo-q5_0.bin'),
    vadModel: env.WHISPER_VAD_MODEL ? expandHome(env.WHISPER_VAD_MODEL) : join(models, 'ggml-silero-v5.1.2.bin'),
  };
}

function expandHome(path: string): string {
  return path === '~' || path.startsWith('~/') ? join(homedir(), path.slice(1)) : path;
}
