import { networkRequest, type Extras, type NetworkRequest } from './common.js';

export type StreamableType = 'Background' | 'Server' | 'Subtitle';
export type SubtitleType = 'VTT' | 'SRT' | 'ASS';
export type SourceType = 'Progressive' | 'HLS' | 'DASH';

export interface Streamable {
  readonly id: string;
  readonly quality: number;
  readonly type: StreamableType;
  readonly title: string | null;
  readonly extras: Extras;
}

export interface HttpSource {
  readonly sourceKind: 'Http';
  readonly request: NetworkRequest;
  readonly type: SourceType;
  readonly decryption: null;
  readonly quality: number;
  readonly title: string | null;
  readonly isVideo: boolean;
  readonly isLive: boolean;
}

export type Source = HttpSource;

export type StreamMedia =
  | { readonly mediaKind: 'Server'; readonly sources: readonly Source[]; readonly merged: boolean }
  | { readonly mediaKind: 'Subtitle'; readonly url: string; readonly type: SubtitleType }
  | { readonly mediaKind: 'Background'; readonly request: NetworkRequest };

/** A direct progressive HTTP source, as the extension builds it from a stream URL. */
export function httpSource(url: string): HttpSource {
  return {
    sourceKind: 'Http',
    request: networkRequest(url),
    type: 'Progressive',
    decryption: null,
    quality: 0,
    title: null,
    isVideo: false,
    isLive: false,
  };
}

export function serverMedia(url: string): StreamMedia {
  return { mediaKind: 'Server', sources: [httpSource(url)], merged: false };
}

/** Server streamable (a playable stream reference on a track). Kotlin Streamable.server(). */
export function serverStreamable(id: string, quality: number, title: string | null = null): Streamable {
  return { id, quality, type: 'Server', title, extras: {} };
}
