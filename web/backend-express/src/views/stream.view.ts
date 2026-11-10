import type { StreamMedia } from '../models/echo/streamable.js';
import type { Json } from '../models/json.js';
import { MODEL, requestView, type Registrar } from './common.js';

/** Stream media. Every source URL is registered with the proxy (as the Kotlin server did). */
export function streamView(media: StreamMedia, issue: Registrar): Json {
  switch (media.mediaKind) {
    case 'Server':
      return {
        mediaType: `${MODEL}Streamable.Media.Server`,
        sources: media.sources.map((source) => {
          issue(source.request.url, source.request.headers);
          return {
            sourceType: `${MODEL}Streamable.Source.Http`,
            id: source.request.url,
            request: requestView(source.request),
            type: source.type,
            decryption: null,
            quality: source.quality,
            title: source.title,
            isVideo: source.isVideo,
            isLive: source.isLive,
          };
        }),
        merged: media.merged,
      };
    case 'Subtitle':
      return { mediaType: `${MODEL}Streamable.Media.Subtitle`, url: media.url, type: media.type };
    case 'Background':
      return { mediaType: `${MODEL}Streamable.Media.Background`, request: requestView(media.request) };
  }
}
