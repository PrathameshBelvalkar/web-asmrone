import { feedOfPaged, type Feed } from '../../../models/feed.js';
import { PagedData } from '../../../models/paged-data.js';
import type { Lyric, Lyrics } from '../../../models/echo/lyrics.js';
import type { Track } from '../../../models/echo/media.js';
import { findFile, type MediaNode } from '../media-tree/tree.js';
import { toTimedLyrics } from '../lyrics/parse.js';
import type { ExtensionContext } from './context.js';
import { languageForCode } from '../languages.js';

/** Lyrics are matched by file name in the work's media tree: "<title>.vtt", then "<title>.lrc". */
export class LyricsFeature {
  constructor(private readonly ctx: ExtensionContext) {}

  searchTrackLyrics(track: Track): Feed<Lyrics> {
    return feedOfPaged(
      PagedData.single<Lyrics>(async () => {
        const album = track.album;
        if (!album) return [];
        const untranslatedTitle = track.extras.untranslatedTitle ?? track.title;
        const lyric = await this.getLyrics(album.id, untranslatedTitle);
        if (lyric === null || lyric.kind !== 'Timed' || lyric.list.length === 0) return [];
        return [
          {
            id: untranslatedTitle,
            title: track.title,
            subtitle: null,
            lyrics: lyric,
            extras: { workId: album.id },
          },
        ];
      }),
    );
  }

  async loadLyrics(lyrics: Lyrics): Promise<Lyrics> {
    const workId = lyrics.extras.workId;
    if (workId === undefined) throw new Error('Expected workId in extras');
    return { ...lyrics, lyrics: await this.getLyrics(workId, lyrics.id) };
  }

  private async getLyrics(workId: string, untranslatedTitle: string): Promise<Lyric | null> {
    const tree = await this.ctx.api.getWorkMediaTree(workId);
    const stripped = untranslatedTitle.replace(/\.mp3$/, '').replace(/\.wav$/, '');
    const file = asText(findFile(tree, `${untranslatedTitle}.vtt`)) ?? asText(findFile(tree, `${stripped}.lrc`));
    if (file === null) return null;
    const text = await this.ctx.api.getSubtitleFile(file.mediaDownloadUrl);
    const language = languageForCode(this.ctx.settings()?.getString('translationLanguage') ?? null);
    return toTimedLyrics(text, language);
  }
}

function asText(node: MediaNode | null): Extract<MediaNode, { type: 'text' }> | null {
  return node?.type === 'text' ? node : null;
}
