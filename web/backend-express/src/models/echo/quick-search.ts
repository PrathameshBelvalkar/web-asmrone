import type { Extras } from './common.js';
import type { EchoMediaItem } from './media.js';

export type QuickSearchItem =
  | { readonly kind: 'Query'; readonly query: string; readonly searched: boolean; readonly extras: Extras }
  | { readonly kind: 'Media'; readonly media: EchoMediaItem; readonly searched: boolean };
