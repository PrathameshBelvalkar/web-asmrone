/**
 * Two error families:
 *  - ClientException: raised by the music extension (domain). Mapped to HTTP by the error handler.
 *  - HttpError: raised by HTTP-facing code. Carries the exact status and wire `type`.
 */

export class ClientException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class LoginRequiredException extends ClientException {}

export class UnauthorizedException extends LoginRequiredException {
  constructor(readonly userId: string) {
    super(`Session expired for ${userId}`);
  }
}

export class NotSupportedException extends ClientException {
  constructor(readonly operation: string) {
    super(operation);
  }
}

export type HttpErrorType =
  | 'bad_request'
  | 'login_required'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'expired'
  | 'not_supported'
  | 'upstream'
  | 'other';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly errorType: HttpErrorType,
    /** Shown as `message` in the JSON body. `null` serialises as JSON null. */
    readonly publicMessage: string | null = null,
  ) {
    super(publicMessage ?? errorType);
    this.name = 'HttpError';
  }

  static badRequest(message: string): HttpError {
    return new HttpError(400, 'bad_request', message);
  }

  static forbidden(message: string): HttpError {
    return new HttpError(403, 'forbidden', message);
  }

  static notFound(): HttpError {
    return new HttpError(404, 'not_found');
  }

  static expired(): HttpError {
    return new HttpError(410, 'expired', 'This list expired. Reopen it.');
  }

  static upstream(status: number, message: string): HttpError {
    return new HttpError(status, 'upstream', message);
  }
}
