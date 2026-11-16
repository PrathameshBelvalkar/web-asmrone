/** jav.guru: full-movie streams for the JAV section (see docs/JAV.md section 11). Not licensed. */
export const JAVGURU_SITE = 'https://jav.guru';
/** Sent with every request. Plain, honest identity; no browser impersonation. */
export { APP_USER_AGENT } from '../threehentai/constants.js';

/**
 * The StreamSB-style host that STREAM SB currently sends to. Echo goes straight to it and asks the
 * site's gateway (`/searcho/`, which robots.txt disallows) only when this host stops answering.
 */
export const DEFAULT_EMBED_HOST = 'javclan.com';

/** The button label of each server Echo uses → the gateway parameter that carries its token. */
export const SERVERS = { sb: { label: 'STREAM SB', param: 'xd' } } as const;
export type JavguruServer = keyof typeof SERVERS;
