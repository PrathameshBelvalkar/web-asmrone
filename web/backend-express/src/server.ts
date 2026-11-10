import { loadConfig } from './config/env.js';
import { createApp } from './app.js';
import { createContainer } from './container.js';
import { createLogger } from './lib/logger.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  if (process.env.ECHO_WEB_DIST !== undefined && config.distDir === null) {
    logger.warn({ path: process.env.ECHO_WEB_DIST }, 'ECHO_WEB_DIST is not a directory; the UI is not served');
  }
  const container = createContainer(config, logger);
  await container.init();

  const app = createApp(container, logger);
  const server = app.listen(config.port, config.host, () => {
    logger.info(
      { url: `http://${config.host}:${config.port}`, dataDir: config.dataDir, ui: config.distDir ?? 'not built' },
      'Echo Web listening',
    );
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      void container.close().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
