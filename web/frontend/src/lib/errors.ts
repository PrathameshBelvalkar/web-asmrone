import { ApiError } from '../api/client';

/** Human-readable message for an error from the server or the network. */
export function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.type) {
      case 'login_required':
        return 'Log in under Settings to use this.';
      case 'unauthorized':
        return 'Your asmr.one session has expired. Log in again under Settings.';
      case 'not_supported':
        return 'This action is not supported for asmr.one.';
      case 'expired':
        return 'That list expired. Reopen it to continue.';
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export function isLoginProblem(error: unknown): boolean {
  return error instanceof ApiError && (error.type === 'login_required' || error.type === 'unauthorized');
}
