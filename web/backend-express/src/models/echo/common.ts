/**
 * Shared value types of the Echo `common` slice. Field names match the Kotlin constructor
 * properties (kotlinx serialises only those). `kind` is a domain tag; views map it to the wire.
 */

export type HttpMethod =
  | 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'TRACE' | 'CONNECT';

export interface NetworkRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: HttpMethod;
  readonly bodyBase64: string | null;
}

export function networkRequest(
  url: string,
  headers: Readonly<Record<string, string>> = {},
  method: HttpMethod = 'GET',
): NetworkRequest {
  return { url, headers, method, bodyBase64: null };
}

export type ImageHolder =
  | { readonly kind: 'NetworkRequest'; readonly request: NetworkRequest; readonly crop: boolean }
  | { readonly kind: 'ResourceUri'; readonly uri: string; readonly crop: boolean }
  | { readonly kind: 'ResourceId'; readonly resId: number; readonly crop: boolean }
  | { readonly kind: 'HexColor'; readonly hex: string };

/** Image from a URL. `crop` defaults to false, as in Kotlin's `toImageHolder`. */
export function imageFromUrl(url: string, headers: Record<string, string> = {}, crop = false): ImageHolder {
  return { kind: 'NetworkRequest', request: networkRequest(url, headers), crop };
}

const HEX_PATTERN = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;

export function hexColor(hex: string): ImageHolder {
  if (!HEX_PATTERN.test(hex)) {
    throw new RangeError(`Invalid hex color format: ${hex}. Use #RRGGBB or #AARRGGBB.`);
  }
  return { kind: 'HexColor', hex };
}

/** Kotlin `Date` is a wrapper over epoch milliseconds. */
export interface EchoDate {
  readonly epochTimeMs: number;
}

/**
 * Kotlin `Date(year, month?, day?)`: `Calendar.getInstance()` then `set(year, month, day)`. The date
 * fields are replaced and the time of day (hour, minute, second, millisecond) stays the current
 * time, in local time. So the value changes with each request, as it does on the Kotlin server.
 */
export function dateFromYmd(year: number, month?: number, day?: number, now: Date = new Date()): EchoDate {
  const date = new Date(
    year,
    (month ?? 1) - 1,
    day ?? 1,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
  return { epochTimeMs: date.getTime() };
}

export interface Tab {
  readonly id: string;
  readonly title: string;
  readonly isSort: boolean;
  readonly extras: Readonly<Record<string, string>>;
}

export type Extras = Readonly<Record<string, string>>;

export interface User {
  readonly id: string;
  readonly name: string;
  readonly cover: ImageHolder | null;
  readonly subtitle: string | null;
  readonly extras: Extras;
}
