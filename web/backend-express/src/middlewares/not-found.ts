import type { RequestHandler } from 'express';

/** Unknown /api route, any method: JSON `not_found`. */
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ type: 'not_found', message: null });
};
