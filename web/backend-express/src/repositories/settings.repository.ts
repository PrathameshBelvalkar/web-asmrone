import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { appLogger } from '../lib/app-logger.js';
import { writeFileAtomic } from '../lib/atomic-file.js';
import { Mutex } from '../lib/mutex.js';
import type { Settings } from '../models/echo/settings.js';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const objectSchema = z.record(z.string(), z.unknown());

/**
 * Settings persisted as one JSON object (`settings.json`): key → raw JSON value.
 * Reads are synchronous from memory. Writes go to disk atomically, one at a time.
 * Same file format as the Kotlin JsonSettings, so an existing install carries over.
 */
export class SettingsRepository implements Settings {
  private readonly values: Map<string, Json>;
  private readonly saveLock = new Mutex();

  constructor(private readonly file: string) {
    this.values = new Map(Object.entries(loadObject(file)));
  }

  /** Raw JSON value for a key, as stored (used by the settings view to echo values back). */
  raw(key: string): Json | undefined {
    return this.values.get(key);
  }

  /** Stores a raw JSON value (null or undefined removes the key) and persists. */
  async setRaw(key: string, value: Json | undefined): Promise<void> {
    this.update(key, value);
    await this.persist();
  }

  getString(key: string): string | null {
    const v = this.values.get(key);
    if (v === undefined || v === null) return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return null;
  }

  putString(key: string, value: string | null): void {
    this.update(key, value ?? undefined);
    this.persistInBackground();
  }

  getStringSet(key: string): ReadonlySet<string> | null {
    const v = this.values.get(key);
    if (!Array.isArray(v)) return null;
    return new Set(v.flatMap((item) => (typeof item === 'string' ? [item] : [])));
  }

  putStringSet(key: string, value: ReadonlySet<string> | null): void {
    this.update(key, value === null ? undefined : [...value]);
    this.persistInBackground();
  }

  getInt(key: string): number | null {
    const v = this.values.get(key);
    if (typeof v === 'number' && Number.isInteger(v)) return v;
    if (typeof v === 'string' && /^-?\d+$/.test(v)) return Number(v);
    return null;
  }

  putInt(key: string, value: number | null): void {
    this.update(key, value ?? undefined);
    this.persistInBackground();
  }

  getBoolean(key: string): boolean | null {
    const v = this.values.get(key);
    if (typeof v === 'boolean') return v;
    if (v === 'true') return true;
    if (v === 'false') return false;
    return null;
  }

  putBoolean(key: string, value: boolean | null): void {
    this.update(key, value ?? undefined);
    this.persistInBackground();
  }

  private update(key: string, value: Json | undefined): void {
    if (value === undefined || value === null) this.values.delete(key);
    else this.values.set(key, value);
  }

  private persist(): Promise<void> {
    return this.saveLock.run(() =>
      writeFileAtomic(this.file, JSON.stringify(Object.fromEntries(this.values), null, 4)),
    );
  }

  /** Used by the synchronous Settings setters. Failures are rethrown on the next save. */
  private persistInBackground(): void {
    this.persist().catch((err: unknown) => {
      appLogger().error({ err }, 'settings.json write failed');
    });
  }
}

function loadObject(file: string): Record<string, Json> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    const obj = objectSchema.safeParse(parsed);
    return obj.success ? (obj.data as Record<string, Json>) : {};
  } catch {
    return {};
  }
}
