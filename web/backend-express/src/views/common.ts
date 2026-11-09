import type { EchoDate, ImageHolder, NetworkRequest } from '../models/echo/common.js';
import type { Json } from '../models/json.js';

/** Fully-qualified discriminator prefix used by the Kotlin server for polymorphic types. */
export const MODEL = 'dev.brahmkshatriya.echo.common.models.';

/** Registers an upstream URL so the proxy will serve it. */
export type Registrar = (url: string) => void;
export const NO_REGISTRATION: Registrar = () => undefined;

export function requestView(request: NetworkRequest): Json {
  return {
    url: request.url,
    headers: { ...request.headers },
    method: request.method,
    bodyBase64: request.bodyBase64,
  };
}

/** Network images are registered for proxying. Other image kinds are passed through. */
export function imageView(image: ImageHolder | null, issue: Registrar): Json {
  if (image === null) return null;
  switch (image.kind) {
    case 'NetworkRequest':
      issue(image.request.url);
      return {
        type: `${MODEL}ImageHolder.NetworkRequestImageHolder`,
        request: requestView(image.request),
        crop: image.crop,
      };
    case 'ResourceUri':
      return { type: `${MODEL}ImageHolder.ResourceUriImageHolder`, uri: image.uri, crop: image.crop };
    case 'ResourceId':
      return { type: `${MODEL}ImageHolder.ResourceIdImageHolder`, resId: image.resId, crop: image.crop };
    case 'HexColor':
      return { type: `${MODEL}ImageHolder.HexColorImageHolder`, hex: image.hex };
  }
}

export function dateView(date: EchoDate | null): Json {
  return date === null ? null : { epochTimeMs: date.epochTimeMs };
}

export function extrasView(extras: Readonly<Record<string, string>>): Json {
  return { ...extras };
}
