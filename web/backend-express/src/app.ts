import express from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Container } from './container.js';
import { errorHandler } from './middlewares/error-handler.js';
import { staticUi } from './middlewares/static-ui.js';
import { createApiRouter } from './routes/index.js';

/** Express application: request logging, the /api router, the built UI, and the error handler. No listen. */
export function createApp(container: Container, logger: Logger): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(pinoHttp({ logger, autoLogging: { ignore: () => false } }));
  app.use('/api', createApiRouter(container.controllers));
  app.use(staticUi(container.config.distDir));
  app.use(
    errorHandler({
      logger,
      onSessionExpired: container.onSessionExpired,
    }),
  );
  return app;
}
