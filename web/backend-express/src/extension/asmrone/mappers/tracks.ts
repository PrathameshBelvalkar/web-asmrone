import type { Album, Track } from '../../../models/echo/media.js';
import { makeTrack } from '../../../models/echo/media.js';
import { serverStreamable } from '../../../models/echo/streamable.js';
import type { AudioNode } from '../media-tree/tree.js';

/** Audio node → track. Duration is seconds in the tree, milliseconds on the track (truncated). */
export function audioToTrack(audio: AudioNode, album: Album, folderTitle: string): Track {
  return makeTrack({
    id: audio.hash,
    title: audio.title,
    album,
    artists: album.artists,
    cover: album.cover,
    duration: Math.trunc(audio.duration * 1000),
    isExplicit: album.isExplicit,
    releaseDate: album.releaseDate,
    isLikeable: true,
    isRadioSupported: true,
    isShareable: true,
    isPlayable: { kind: 'Yes' },
    isSaveable: true,
    streamables: [serverStreamable(audio.mediaStreamUrl, 1, audio.title)],
    extras: {
      folderTitle,
      untranslatedTitle: audio.untranslatedTitle,
      id: album.id,
      isLiked: album.extras.isLiked ?? 'false',
      // A smaller copy, used for AI subtitles (speech recognition doesn't need full quality).
      ...(audio.streamLowQualityUrl ? { lowQualityStreamUrl: audio.streamLowQualityUrl } : {}),
    },
  });
}
