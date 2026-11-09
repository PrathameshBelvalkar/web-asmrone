import { randomUUID } from 'node:crypto';
import { type Clock, systemClock } from '../lib/clock.js';

interface Entry<T> {
  readonly value: T;
  lastAccess: number;
}

/**
 * Opaque id → live object, with a sliding idle timeout and a size cap.
 * - Each `get` refreshes the entry's idle timer.
 * - When full, the oldest-inserted entry is evicted (FIFO, as in the Kotlin server).
 * - Expired or unknown ids return undefined.
 */
export class ExpiringRegistry<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly maxSize: number,
    private readonly ttlMs: number,
    private readonly clock: Clock = systemClock,
  ) {}

  put(value: T): string {
    this.purge();
    const id = randomUUID();
    this.entries.set(id, { value, lastAccess: this.clock.now() });
    while (this.entries.size > this.maxSize) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
    return id;
  }

  get(id: string): T | undefined {
    this.purge();
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    entry.lastAccess = this.clock.now();
    return entry.value;
  }

  get size(): number {
    return this.entries.size;
  }

  private purge(): void {
    const cutoff = this.clock.now() - this.ttlMs;
    for (const [id, entry] of this.entries) {
      if (entry.lastAccess < cutoff) this.entries.delete(id);
    }
  }
}
