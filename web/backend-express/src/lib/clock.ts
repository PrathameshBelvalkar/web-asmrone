/** Injectable clock so TTL behaviour can be tested without sleeping. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };
