import type { Server } from 'node:http';
import type { Express } from 'express';
import { loadConfig } from './config/env.js';
import { createApp } from './app.js';
import { createContainer } from './container.js';
import { createLogger } from './lib/logger.js';

export interface RunningServer {
  readonly port: number;
  readonly url: string;
  close(): Promise<void>;
}

/**
 * Starts the server and resolves once it is listening. Used by the command-line entry
 * (`server.ts`) and by the desktop app, which runs it as a child process and stops it on quit.
 */
export async function startServer(env: NodeJS.ProcessEnv = process.env): Promise<RunningServer> {
  const config = loadConfig(env);
  const logger = createLogger(config.logLevel);
  if (env.ECHO_WEB_DIST !== undefined && config.distDir === null) {
    logger.warn(
      { path: env.ECHO_WEB_DIST },
      'ECHO_WEB_DIST is not a directory; the UI is not served',
    );
  }
  const container = createContainer(config, logger);
  await container.init();

  const app = createApp(container, logger);
  let server: Server;
  try {
    server = await listen(app, config.port, config.host);
  } catch (err) {
    await container.close();
    throw err;
  }

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : config.port;
  const url = `http://${config.host}:${port}`;
  logger.info(
    { url, dataDir: config.dataDir, ui: config.distDir ?? 'not built' },
    'Echo Web listening',
  );

  return {
    port,
    url,
    close: async () => {
      // Open audio streams would otherwise keep server.close() waiting.
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      await container.close();
    },
  };
}

function listen(app: Express, port: number, host: string): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);
    const onError = (err: Error): void => {
      reject(err);
    };
    server.once('error', onError);
    server.once('listening', () => {
      server.off('error', onError);
      resolve(server);
    });
  });
}
