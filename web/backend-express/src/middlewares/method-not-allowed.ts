import type { RequestHandler } from 'express';

export interface RouteMeta {
  readonly method: 'GET' | 'POST' | 'PUT';
  /** Express-style path, e.g. "/feeds/:id/open". */
  readonly path: string;
}

/**
 * Known path, wrong method: 405 with an Allow header (the Kotlin server did the same).
 * Unknown paths fall through to the JSON 404. HEAD is answered by the GET routes, as Express does.
 */
export function methodNotAllowed(routes: readonly RouteMeta[]): RequestHandler {
  return (req, res, next) => {
    const method = req.method === 'HEAD' ? 'GET' : req.method;
    const allowed = [...new Set(routes.filter((r) => matches(r.path, req.path)).map((r) => r.method))];
    if (allowed.length === 0 || allowed.includes(method as RouteMeta['method'])) {
      next();
      return;
    }
    res.setHeader('Allow', allowed.join(', '));
    res.status(405).json({ type: 'method_not_allowed', message: null });
  };
}

/** Matches a template where ":name" segments match any non-empty segment. */
export function matches(template: string, path: string): boolean {
  const want = template.split('/');
  const got = path.split('/');
  if (want.length !== got.length) return false;
  return want.every((segment, i) => (segment.startsWith(':') ? (got[i] ?? '').length > 0 : segment === got[i]));
}
