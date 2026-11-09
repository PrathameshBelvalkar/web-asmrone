import type { Lyrics, Lyric } from '../models/echo/lyrics.js';
import type { PageItem, ViewContext } from '../models/presentation.js';
import type { Json } from '../models/json.js';
import { mediaView } from './media.view.js';
import { shelfView } from './shelf.view.js';

/** PageDto. Each item is a shelf, a media item, or lyrics, told apart by their fields. */
export function pageView(items: readonly PageItem[], continuation: string | null, ctx: ViewContext): Json {
  return {
    items: items.map((item) => pageItemView(item, ctx)),
    continuation,
  };
}

function pageItemView(item: PageItem, ctx: ViewContext): Json {
  if ('shelfKind' in item) return shelfView(item, ctx);
  if ('kind' in item) return mediaView(item, ctx.issueUrl);
  return lyricsView(item);
}

/** Lyrics are never registered with the proxy. */
export function lyricsView(lyrics: Lyrics): Json {
  return {
    id: lyrics.id,
    title: lyrics.title,
    subtitle: lyrics.subtitle,
    lyrics: lyricView(lyrics.lyrics),
    extras: { ...lyrics.extras },
  };
}

function lyricView(lyric: Lyric | null): Json {
  if (lyric === null) return null;
  const MODEL = 'dev.brahmkshatriya.echo.common.models.Lyrics.';
  switch (lyric.kind) {
    case 'Simple':
      return { type: `${MODEL}Simple`, text: lyric.text };
    case 'Timed':
      return {
        type: `${MODEL}Timed`,
        list: lyric.list.map((l) => ({ text: l.text, startTime: l.startTime, endTime: l.endTime })),
        fillTimeGaps: lyric.fillTimeGaps,
      };
    case 'WordByWord':
      return {
        type: `${MODEL}WordByWord`,
        list: lyric.list.map((line) => line.map((l) => ({ text: l.text, startTime: l.startTime, endTime: l.endTime }))),
        fillTimeGaps: lyric.fillTimeGaps,
      };
  }
}
