import { appLogger } from '../../../lib/app-logger.js';
import type { Settings } from '../../../models/echo/settings.js';
import type { AsmrApiClient } from '../api/asmr-api.client.js';
import type { PendingLikes } from '../mappers/works.js';

/** Shared state for every feature: the API client, pending likes and the live settings. */
export interface ExtensionContext {
  readonly api: AsmrApiClient;
  readonly pendingLikes: PendingLikes;
  readonly settings: () => Settings | null;
}

/** Shelves that exceed this are dropped from the home feed (patch 10). */
export const SLOW_SHELF_TIMEOUT_MS = 4_000;

/** Resolves to null if `task` does not finish within `ms`. */
export async function withTimeoutOrNull<T>(ms: number, task: () => Promise<T>): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      resolve(null);
    }, ms);
  });
  try {
    return await Promise.race([task(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Runs a shelf loader; a failure is logged and the shelf is skipped (patch 9). */
export async function shelfOrNull<T>(task: () => Promise<T | null>): Promise<T | null> {
  try {
    return await task();
  } catch (err) {
    appLogger().warn({ err }, 'shelf skipped');
    return null;
  }
}
