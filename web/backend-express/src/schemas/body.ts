import { HttpError } from '../models/errors.js';

/** Request body accessors that mirror the Kotlin `body()` helpers. Missing keys are `undefined`. */
export type JsonObject = Readonly<Record<string, unknown>>;

export function optionalString(body: JsonObject, key: string): string | undefined {
  const value = body[key];
  return typeof value === 'string' ? value : undefined;
}

export function requiredString(body: JsonObject, key: string): string {
  const value = optionalString(body, key);
  if (value === undefined) throw HttpError.badRequest(`${key} is required`);
  return value;
}

export function optionalBoolean(body: JsonObject, key: string): boolean | undefined {
  const value = body[key];
  return typeof value === 'boolean' ? value : undefined;
}

/** Integer or undefined. Non-integers are treated as absent (Kotlin `intOrNull`). */
export function optionalInt(body: JsonObject, key: string): number | undefined {
  const value = body[key];
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

/** Each element as an integer; non-integers become 0 (Kotlin remove-tracks behaviour). */
export function intArray(body: JsonObject, key: string): number[] {
  const value = body[key];
  if (!Array.isArray(value)) return [];
  return value.map((v) => (typeof v === 'number' && Number.isInteger(v) ? v : 0));
}

export function jsonArray(body: JsonObject, key: string): unknown[] {
  const value = body[key];
  return Array.isArray(value) ? value : [];
}

/** Primitive values as strings, other values as null (Kotlin login `data` handling). */
export function primitiveMap(value: unknown): Record<string, string | null> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw HttpError.badRequest('Body must be a JSON object');
  }
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : null,
    ]),
  );
}
