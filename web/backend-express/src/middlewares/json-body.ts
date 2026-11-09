import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { HttpError } from '../models/errors.js';

const textParser = express.text({ type: () => true, limit: '5mb' });

/**
 * Reads the body as text and parses it into a JSON object (Kotlin `call.body()`): blank means
 * `{}`, and anything that is not a JSON object is a 400. GET and HEAD bodies are ignored.
 */
export function jsonObjectBody(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      req.jsonBody = {};
      next();
      return;
    }
    textParser(req, res, (err?: unknown) => {
      if (err) {
        next(err);
        return;
      }
      try {
        req.jsonBody = parseJsonObject(typeof req.body === 'string' ? req.body : '');
        next();
      } catch (parseErr) {
        next(parseErr);
      }
    });
  };
}

export function parseJsonObject(text: string): Record<string, unknown> {
  if (text.trim().length === 0) return {};
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw HttpError.badRequest('Body must be a JSON object');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw HttpError.badRequest('Body must be a JSON object');
  }
  return value as Record<string, unknown>;
}
