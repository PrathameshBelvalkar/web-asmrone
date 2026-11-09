/**
 * Wire JSON → domain objects for media items, images, streams and lyrics sent by the client.
 * Mirrors Codec.decodeMedia (kotlinx with ignoreUnknownKeys). Absent optional fields stay
 * `undefined`, so the factories apply the same defaults as the Kotlin constructors.
 */
import { z } from 'zod';
import { HttpError } from '../models/errors.js';
import {
  hexColor,
  type EchoDate,
  type ImageHolder,
  type NetworkRequest,
} from '../models/echo/common.js';
import {
  makeAlbum,
  makeArtist,
  makePlaylist,
  makeRadio,
  makeTrack,
  type Album,
  type Artist,
  type EchoMediaItem,
  type Playable,
  type Playlist,
  type Radio,
  type Track,
} from '../models/echo/media.js';
import type { Streamable } from '../models/echo/streamable.js';

const MODEL = 'dev.brahmkshatriya.echo.common.models.';
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'] as const;

const extrasSchema = z.record(z.string(), z.string());
const nullableString = z.string().nullish();
const nullableNumber = z.number().nullish();
const dateSchema = z.object({ epochTimeMs: z.number() }).nullish();

const requestSchema = z.object({
  url: z.string(),
  headers: z.record(z.string(), z.string()).default({}),
  method: z.enum(HTTP_METHODS).default('GET'),
  bodyBase64: z.string().nullish(),
});

/** Image holder by its `type` discriminator (fully-qualified Kotlin class name). */
export function parseImage(value: unknown): ImageHolder | null {
  if (value === null || value === undefined) return null;
  const parsed = z.looseObject({ type: z.string() }).parse(value);
  const { type } = parsed;
  if (type.endsWith('NetworkRequestImageHolder')) {
    const v = z.object({ request: requestSchema, crop: z.boolean().default(false) }).parse(value);
    const request: NetworkRequest = {
      url: v.request.url,
      headers: v.request.headers,
      method: v.request.method,
      bodyBase64: v.request.bodyBase64 ?? null,
    };
    return { kind: 'NetworkRequest', request, crop: v.crop };
  }
  if (type.endsWith('ResourceUriImageHolder')) {
    const v = z.object({ uri: z.string(), crop: z.boolean().default(false) }).parse(value);
    return { kind: 'ResourceUri', uri: v.uri, crop: v.crop };
  }
  if (type.endsWith('ResourceIdImageHolder')) {
    const v = z.object({ resId: z.number().int(), crop: z.boolean().default(false) }).parse(value);
    return { kind: 'ResourceId', resId: v.resId, crop: v.crop };
  }
  if (type.endsWith('HexColorImageHolder')) {
    const v = z.object({ hex: z.string() }).parse(value);
    return hexColor(v.hex);
  }
  throw HttpError.badRequest(`Unknown image type: ${type}`);
}

/** Like parseImage but keeps `undefined` as "not supplied", so factory defaults apply. */
function optionalImage(value: unknown): ImageHolder | null | undefined {
  return value === undefined ? undefined : parseImage(value);
}

function toDate(value: { epochTimeMs: number } | null | undefined): EchoDate | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return { epochTimeMs: value.epochTimeMs };
}

const artistSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    cover: z.unknown().optional(),
    bio: nullableString,
    background: z.unknown().optional(),
    banners: z.array(z.unknown()).optional(),
    subtitle: nullableString,
    extras: extrasSchema.optional(),
    isRadioSupported: z.boolean().optional(),
    isFollowable: z.boolean().optional(),
    isSaveable: z.boolean().optional(),
    isLikeable: z.boolean().optional(),
    isHideable: z.boolean().optional(),
    isShareable: z.boolean().optional(),
  })
  .transform((v): Artist =>
    makeArtist({
      id: v.id,
      name: v.name,
      cover: optionalImage(v.cover),
      bio: v.bio,
      background: optionalImage(v.background),
      banners: v.banners?.flatMap((b) => {
        const image = parseImage(b);
        return image ? [image] : [];
      }),
      subtitle: v.subtitle,
      extras: v.extras,
      isRadioSupported: v.isRadioSupported,
      isFollowable: v.isFollowable,
      isSaveable: v.isSaveable,
      isLikeable: v.isLikeable,
      isHideable: v.isHideable,
      isShareable: v.isShareable,
    }),
  );

const albumSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['PreRelease', 'Single', 'EP', 'LP', 'Compilation', 'Show', 'Book']).nullish(),
    cover: z.unknown().optional(),
    artists: z.array(artistSchema).optional(),
    trackCount: nullableNumber,
    duration: nullableNumber,
    releaseDate: dateSchema,
    description: nullableString,
    background: z.unknown().optional(),
    label: nullableString,
    isExplicit: z.boolean().optional(),
    subtitle: nullableString,
    extras: extrasSchema.optional(),
    isRadioSupported: z.boolean().optional(),
    isFollowable: z.boolean().optional(),
    isSaveable: z.boolean().optional(),
    isLikeable: z.boolean().optional(),
    isHideable: z.boolean().optional(),
    isShareable: z.boolean().optional(),
  })
  .transform((v): Album =>
    makeAlbum({
      id: v.id,
      title: v.title,
      type: v.type,
      cover: optionalImage(v.cover),
      artists: v.artists,
      trackCount: v.trackCount,
      duration: v.duration,
      releaseDate: toDate(v.releaseDate),
      description: v.description,
      background: optionalImage(v.background),
      label: v.label,
      isExplicit: v.isExplicit,
      subtitle: v.subtitle,
      extras: v.extras,
      isRadioSupported: v.isRadioSupported,
      isFollowable: v.isFollowable,
      isSaveable: v.isSaveable,
      isLikeable: v.isLikeable,
      isHideable: v.isHideable,
      isShareable: v.isShareable,
    }),
  );

const playlistSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    isEditable: z.boolean(),
    isPrivate: z.boolean().optional(),
    cover: z.unknown().optional(),
    authors: z.array(artistSchema).optional(),
    trackCount: nullableNumber,
    duration: nullableNumber,
    creationDate: dateSchema,
    description: nullableString,
    background: z.unknown().optional(),
    subtitle: nullableString,
    extras: extrasSchema.optional(),
    isRadioSupported: z.boolean().optional(),
    isFollowable: z.boolean().optional(),
    isSaveable: z.boolean().optional(),
    isLikeable: z.boolean().optional(),
    isHideable: z.boolean().optional(),
    isShareable: z.boolean().optional(),
  })
  .transform((v): Playlist =>
    makePlaylist({
      id: v.id,
      title: v.title,
      isEditable: v.isEditable,
      isPrivate: v.isPrivate,
      cover: optionalImage(v.cover),
      authors: v.authors,
      trackCount: v.trackCount,
      duration: v.duration,
      creationDate: toDate(v.creationDate),
      description: v.description,
      background: optionalImage(v.background),
      subtitle: v.subtitle,
      extras: v.extras,
      isRadioSupported: v.isRadioSupported,
      isFollowable: v.isFollowable,
      isSaveable: v.isSaveable,
      isLikeable: v.isLikeable,
      isHideable: v.isHideable,
      isShareable: v.isShareable,
    }),
  );

const radioSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    cover: z.unknown().optional(),
    authors: z.array(artistSchema).optional(),
    trackCount: nullableNumber,
    description: nullableString,
    subtitle: nullableString,
    extras: extrasSchema.optional(),
    isFollowable: z.boolean().optional(),
    isSaveable: z.boolean().optional(),
    isLikeable: z.boolean().optional(),
    isHideable: z.boolean().optional(),
    isShareable: z.boolean().optional(),
  })
  .transform((v): Radio =>
    makeRadio({
      id: v.id,
      title: v.title,
      cover: optionalImage(v.cover),
      authors: v.authors,
      trackCount: v.trackCount,
      description: v.description,
      subtitle: v.subtitle,
      extras: v.extras,
      isFollowable: v.isFollowable,
      isSaveable: v.isSaveable,
      isLikeable: v.isLikeable,
      isHideable: v.isHideable,
      isShareable: v.isShareable,
    }),
  );

const playableSchema = z.object({ type: z.string(), reason: z.string().optional() });

function parsePlayable(value: unknown): Playable | undefined {
  if (value === undefined) return undefined;
  const v = playableSchema.parse(value);
  if (v.type.endsWith('.Yes')) return { kind: 'Yes' };
  if (v.type.endsWith('.RegionLocked')) return { kind: 'RegionLocked' };
  if (v.type.endsWith('.Unreleased')) return { kind: 'Unreleased' };
  if (v.type.endsWith('.No')) return { kind: 'No', reason: v.reason ?? '' };
  throw HttpError.badRequest(`Unknown playable type: ${v.type}`);
}

const streamableSchema = z.object({
  id: z.string(),
  quality: z.number().int(),
  type: z.enum(['Background', 'Server', 'Subtitle']),
  title: nullableString,
  extras: extrasSchema.optional(),
});

const trackSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['Song', 'Podcast', 'VideoSong', 'Video', 'HorizontalVideo']).optional(),
    cover: z.unknown().optional(),
    artists: z.array(artistSchema).optional(),
    album: albumSchema.nullish(),
    duration: nullableNumber,
    playedDuration: nullableNumber,
    plays: nullableNumber,
    releaseDate: dateSchema,
    description: nullableString,
    background: z.unknown().optional(),
    genres: z.array(z.string()).optional(),
    isrc: nullableString,
    albumOrderNumber: nullableNumber,
    albumDiscNumber: nullableNumber,
    playlistAddedDate: dateSchema,
    isExplicit: z.boolean().optional(),
    subtitle: nullableString,
    extras: extrasSchema.optional(),
    isPlayable: z.unknown().optional(),
    streamables: z.array(streamableSchema).optional(),
    isRadioSupported: z.boolean().optional(),
    isFollowable: z.boolean().optional(),
    isSaveable: z.boolean().optional(),
    isLikeable: z.boolean().optional(),
    isHideable: z.boolean().optional(),
    isShareable: z.boolean().optional(),
  })
  .transform((v): Track =>
    makeTrack({
      id: v.id,
      title: v.title,
      type: v.type,
      cover: optionalImage(v.cover),
      artists: v.artists,
      album: v.album,
      duration: v.duration,
      playedDuration: v.playedDuration,
      plays: v.plays,
      releaseDate: toDate(v.releaseDate),
      description: v.description,
      background: optionalImage(v.background),
      genres: v.genres,
      isrc: v.isrc,
      albumOrderNumber: v.albumOrderNumber,
      albumDiscNumber: v.albumDiscNumber,
      playlistAddedDate: toDate(v.playlistAddedDate),
      isExplicit: v.isExplicit,
      subtitle: v.subtitle,
      extras: v.extras,
      isPlayable: parsePlayable(v.isPlayable),
      streamables: v.streamables as Streamable[] | undefined,
      isRadioSupported: v.isRadioSupported,
      isFollowable: v.isFollowable,
      isSaveable: v.isSaveable,
      isLikeable: v.isLikeable,
      isHideable: v.isHideable,
      isShareable: v.isShareable,
    }),
  );

export type MediaKind = EchoMediaItem['kind'];

const KIND_SCHEMAS = {
  Track: trackSchema,
  Album: albumSchema,
  Artist: artistSchema,
  Playlist: playlistSchema,
  Radio: radioSchema,
} as const;

/** Parses a wire media item. The `mediaItemType` discriminator selects the kind. */
export function parseMediaItem(value: unknown): EchoMediaItem {
  const kind = mediaKindOf(value);
  const schema = KIND_SCHEMAS[kind];
  return safeParse(schema, value);
}

/** Parses a media item and checks its kind (Kotlin `typed<T>()`: "Expected Album"). */
export function parseMediaAs<K extends MediaKind>(value: unknown, kind: K): Extract<EchoMediaItem, { kind: K }> {
  const parsed = parseMediaItem(value);
  if (parsed.kind !== kind) throw HttpError.badRequest(`Expected ${kind}`);
  return parsed as Extract<EchoMediaItem, { kind: K }>;
}

export function parseStreamable(value: unknown): Streamable {
  return safeParse(streamableSchema, value) as Streamable;
}

function mediaKindOf(value: unknown): MediaKind {
  if (value === null || typeof value !== 'object') throw HttpError.badRequest('Missing media item');
  const type = (value as { mediaItemType?: unknown }).mediaItemType;
  if (typeof type !== 'string' || !type.startsWith(MODEL)) {
    throw HttpError.badRequest('Unknown media item type');
  }
  const kind = type.slice(MODEL.length);
  if (kind === 'Track' || kind === 'Album' || kind === 'Artist' || kind === 'Playlist' || kind === 'Radio') {
    return kind;
  }
  throw HttpError.badRequest(`Unknown media item type: ${type}`);
}

function safeParse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw HttpError.badRequest(`Invalid media item: ${detail}`);
  }
  return result.data;
}

