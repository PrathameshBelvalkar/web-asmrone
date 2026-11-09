import type { Logger } from 'pino';
import { createLogger } from './logger.js';

/**
 * Shared logger for modules that have no logger injected (the extension, the settings store).
 * The container installs the configured logger at startup. Until then it is silent.
 */
let current: Logger = createLogger('silent');

export function appLogger(): Logger {
  return current;
}

export function useAppLogger(logger: Logger): void {
  current = logger;
}
