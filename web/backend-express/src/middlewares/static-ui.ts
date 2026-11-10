import express, { type RequestHandler } from 'express';
import { join, sep } from 'node:path';

const NOT_BUILT = 'Echo Web API is running. Build the frontend (web/frontend) to serve the UI.';
const ASSET_DIR = `${sep}assets${sep}`;

/**
 * Serves the built web UI at `/`. Files in `distDir` are served as they are. Any other GET or HEAD
 * gets `index.html`, so client-side routes such as `/work/1` load. Without a build, `/` returns a
 * plain-text hint, as the Kotlin server does. Mount this after the `/api` router so API paths never
 * reach it. `distDir` must be absolute.
 */
export function staticUi(distDir: string | null): RequestHandler[] {
  if (distDir === null) {
    return [
      (req, res, next) => {
        if (req.method === 'GET' && req.path === '/') {
          res.type('text/plain').send(NOT_BUILT);
          return;
        }
        next();
      },
    ];
  }

  const index = join(distDir, 'index.html');
  return [
    express.static(distDir, {
      index: false,
      setHeaders: (res, filePath) => {
        // Vite names bundled files by content hash, so they can be cached forever.
        res.setHeader(
          'Cache-Control',
          filePath.includes(ASSET_DIR) ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    }),
    (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(index, (err) => {
        if (err) next(err);
      });
    },
  ];
}
