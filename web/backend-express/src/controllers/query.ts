import type { Request } from 'express';

/** Query value as a string, or undefined when absent (repeated keys use the first value). */
export function queryString(req: Request, name: string): string | undefined {
  const value = req.query[name];
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

export function paramString(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === 'string' ? value : '';
}
