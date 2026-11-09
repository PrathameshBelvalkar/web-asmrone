import type { Radio, Playlist } from '../models/echo/media.js';
import type { OpenedFeed, ViewContext } from '../models/presentation.js';
import type { Json } from '../models/json.js';
import { feedView } from './feed.view.js';
import { mediaView } from './media.view.js';

/** RadioDto: the radio plus the feed of its tracks. */
export function radioResponseView(radio: Radio, feed: OpenedFeed | null, ctx: ViewContext): Json {
  return { radio: mediaView(radio, ctx.issueUrl), feed: feedView(feed, ctx) };
}

/** EditableDto: a playlist and whether it already holds the track. */
export function editableView(playlist: Playlist, contains: boolean, ctx: ViewContext): Json {
  return { playlist: mediaView(playlist, ctx.issueUrl), contains };
}
