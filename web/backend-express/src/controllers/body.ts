import { HttpError } from '../models/errors.js';
import type { EchoMediaItem, Track } from '../models/echo/media.js';
import { parseMediaAs, parseMediaItem, type MediaKind } from '../schemas/media-item.schema.js';
import type { JsonObject } from '../schemas/body.js';

/** Media item stored under `key`, of the given kind (Kotlin `typed<T>()`). */
export function typedItem<K extends MediaKind>(body: JsonObject, kind: K, key = 'item') {
  if (body[key] === undefined) throw HttpError.badRequest('Missing media item');
  return parseMediaAs(body[key], kind);
}

/** Track list under `key`. Each element must be a track (Kotlin `tracks(key)`). */
export function trackList(body: JsonObject, key: string): Track[] {
  const value = body[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw HttpError.badRequest(`Expected track in ${key}`);
  return value.map((element) => {
    const item: EchoMediaItem = parseMediaItem(element);
    if (item.kind !== 'Track') throw HttpError.badRequest(`Expected track in ${key}`);
    return item;
  });
}

/** Any media item under `key`, or null when the key is absent or JSON null. */
export function optionalItem(body: JsonObject, key: string): EchoMediaItem | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  return parseMediaItem(value);
}
