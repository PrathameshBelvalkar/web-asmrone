import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    /** Parsed request body for non-GET /api requests. Always a plain JSON object. */
    jsonBody: Record<string, unknown>;
  }
}
