import type { Request } from 'express';
import { HttpError } from '../models/errors.js';
import { SOURCE_IDS, isSourceId, type SourceId } from '../models/source.js';

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

/** The `source` query value: `asmrone` by default. Anything else that isn't a source id is a 400. */
export function sourceParam(req: Request): SourceId {
  const value = queryString(req, 'source') ?? 'asmrone';
  if (!isSourceId(value)) throw HttpError.badRequest(`source must be one of: ${SOURCE_IDS.join(', ')}`);
  return value;
}
