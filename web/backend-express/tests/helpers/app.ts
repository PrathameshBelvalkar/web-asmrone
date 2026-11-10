import type { Dispatcher } from 'undici';
import { createApp } from '../../src/app.js';
import type { AppConfig } from '../../src/config/env.js';
import { createContainer, type Container } from '../../src/container.js';
import type { MusicExtension } from '../../src/models/extension.js';
import { createLogger } from '../../src/lib/logger.js';
import { tempDir } from './tmp.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface TestApp {
  readonly app: ReturnType<typeof createApp>;
  readonly container: Container;
  readonly dataDir: string;
  readonly readUserFile: () => Promise<string | null>;
  cleanup(): Promise<void>;
}

/** The real app, wired to a temporary data directory and optional injected dependencies. */
export async function makeTestApp(options: {
  extension?: MusicExtension;
  asmrDispatcher?: Dispatcher;
  proxyDispatcher?: Dispatcher;
  jasmrDispatcher?: Dispatcher;
  distDir?: string | null;
} = {}): Promise<TestApp> {
  const t = await tempDir();
  const config: AppConfig = {
    port: 0,
    host: '127.0.0.1',
    dataDir: t.dir,
    distDir: options.distDir ?? null,
    jasmrCrawlDelayMs: 0,
    logLevel: 'silent',
  };
  const logger = createLogger('silent');
  const container = createContainer(config, logger, options);
  await container.init();
  const app = createApp(container, logger);
  return {
    app,
    container,
    dataDir: t.dir,
    readUserFile: async () => {
      try {
        return await readFile(join(t.dir, 'user.json'), 'utf8');
      } catch {
        return null;
      }
    },
    cleanup: async () => {
      await container.close();
      await t.cleanup();
    },
  };
}
