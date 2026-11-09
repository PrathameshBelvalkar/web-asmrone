import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import {
  ClientException,
  HttpError,
  LoginRequiredException,
  NotSupportedException,
  UnauthorizedException,
} from '../models/errors.js';

export interface ErrorHandlerDeps {
  readonly logger: Logger;
  /** Clears the saved login when asmr.one reports the session as expired. */
  readonly onSessionExpired: () => Promise<void>;
}

interface Mapped {
  readonly status: number;
  readonly type: string;
  readonly message: string | null;
}

/**
 * Maps every error to the wire envelope `{type, message}`. Unknown errors become 500 `other`
 * with the message (or the class name), as the Kotlin server did.
 */
export function errorHandler(deps: ErrorHandlerDeps): ErrorRequestHandler {
  return async (err: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const mapped = await mapError(err, deps);
    if (mapped.status >= 500) deps.logger.error({ err }, 'request failed');
    res.status(mapped.status).json({ type: mapped.type, message: mapped.message });
  };
}

async function mapError(err: unknown, deps: ErrorHandlerDeps): Promise<Mapped> {
  if (err instanceof UnauthorizedException) {
    await deps.onSessionExpired();
    return { status: 401, type: 'unauthorized', message: err.userId };
  }
  if (err instanceof LoginRequiredException) return { status: 401, type: 'login_required', message: null };
  if (err instanceof NotSupportedException) return { status: 501, type: 'not_supported', message: err.operation };
  if (err instanceof HttpError) return { status: err.status, type: err.errorType, message: err.publicMessage };
  if (err instanceof ClientException) return { status: 500, type: 'other', message: err.message };
  if (isBodyParserError(err)) return { status: err.status, type: 'bad_request', message: err.message };
  const message = err instanceof Error && err.message.length > 0 ? err.message : err instanceof Error ? err.name : 'Error';
  return { status: 500, type: 'other', message };
}

function isBodyParserError(err: unknown): err is { status: number; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { status?: unknown }).status === 'number' &&
    (err as { status: number }).status >= 400 &&
    (err as { status: number }).status < 500
  );
}
