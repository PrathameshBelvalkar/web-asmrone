import { describe, expect, it } from 'vitest';
import { makeAlbum, makeArtist, makePlaylist, makeTrack, type EchoMediaItem } from '../../src/models/echo/media.js';
import { imageFromUrl, dateFromYmd } from '../../src/models/echo/common.js';
import { serverStreamable } from '../../src/models/echo/streamable.js';
import { parseMediaAs, parseMediaItem } from '../../src/schemas/media-item.schema.js';
import { HttpError } from '../../src/models/errors.js';
import { mediaView } from '../../src/views/media.view.js';
import { shelfView } from '../../src/views/shelf.view.js';
import { feedView } from '../../src/views/feed.view.js';
import { pageView } from '../../src/views/page.view.js';
import { settingView } from '../../src/views/settings.view.js';
import { quickSearchView } from '../../src/views/quick-search.view.js';
import { feedOfPaged } from '../../src/models/feed.js';
import { PagedData } from '../../src/models/paged-data.js';
import type { ViewContext } from '../../src/models/presentation.js';
import type { Shelf } from '../../src/models/echo/shelf.js';
import type { Json } from '../../src/models/json.js';

const MODEL = 'dev.brahmkshatriya.echo.common.models.';

function recorder(): ViewContext & { urls: string[]; feeds: number } {
  const urls: string[] = [];
  let feeds = 0;
  return {
    urls,
    get feeds() {
      return feeds;
    },
    issueUrl: (url) => {
      urls.push(url);
    },
    registerFeed: () => {
      feeds++;
      return `feed-${feeds}`;
    },
  };
}

describe('wire parsing (Codec.decodeMedia parity)', () => {
  it('selects the kind from mediaItemType and fills Kotlin defaults', () => {
    const item = parseMediaItem({
      mediaItemType: `${MODEL}Album`,
      id: '1',
      title: 'T',
      cover: { type: `${MODEL}ImageHolder.NetworkRequestImageHolder`, request: { url: 'https://img/1' }, crop: true },
    });
    expect(item.kind).toBe('Album');
    if (item.kind !== 'Album') throw new Error('unreachable');
    expect(item.background?.kind).toBe('NetworkRequest'); // background defaults to cover
    expect(item.isShareable).toBe(true);
    expect(item.isLikeable).toBe(false);
    expect(item.artists).toEqual([]);
  });

  it('an explicit null background stays null', () => {
    const item = parseMediaAs({ mediaItemType: `${MODEL}Album`, id: '1', title: 'T', background: null }, 'Album');
    expect(item.background).toBeNull();
  });

  it('rejects a media item of the wrong kind with "Expected <Kind>"', () => {
    expect(() => parseMediaAs({ mediaItemType: `${MODEL}Artist`, id: '1', name: 'x' }, 'Album')).toThrow(
      HttpError,
    );
    try {
      parseMediaAs({ mediaItemType: `${MODEL}Artist`, id: '1', name: 'x' }, 'Album');
    } catch (err) {
      expect((err as HttpError).publicMessage).toBe('Expected Album');
    }
  });

  it('a missing or unknown discriminator is a 400', () => {
    expect(() => parseMediaItem(null)).toThrow(HttpError);
    expect(() => parseMediaItem({ id: '1' })).toThrow(HttpError);
    expect(() => parseMediaItem({ mediaItemType: `${MODEL}Unknown`, id: '1' })).toThrow(HttpError);
  });

  it('artist titles come from the name (Kotlin Artist.title)', () => {
    const artist = parseMediaAs({ mediaItemType: `${MODEL}Artist`, id: '9', name: 'Voice' }, 'Artist');
    expect(artist.name).toBe('Voice');
  });
});

describe('media views (wire shape)', () => {
  it('a top-level album carries its discriminator and registers its own images', () => {
    const ctx = recorder();
    const album = makeAlbum({
      id: '1',
      title: 'Album',
      cover: imageFromUrl('https://img/cover.jpg'),
      releaseDate: dateFromYmd(2020, 1, 1),
    });
    const json = mediaView(album, ctx.issueUrl) as Record<string, Json>;
    expect(json.mediaItemType).toBe(`${MODEL}Album`);
    expect(ctx.urls).toEqual(['https://img/cover.jpg', 'https://img/cover.jpg']); // cover and background
    expect((json.cover as Record<string, Json>).type).toBe(`${MODEL}ImageHolder.NetworkRequestImageHolder`);
    expect(json.label).toBeNull();
    expect(json.trackCount).toBeNull();
  });

  it('nested artists have no discriminator and register nothing', () => {
    const ctx = recorder();
    const track = makeTrack({
      id: 'h1',
      title: 'Track',
      artists: [makeArtist({ id: 'a', name: 'A', cover: imageFromUrl('https://img/artist.jpg') })],
      album: makeAlbum({ id: '1', title: 'Album', cover: imageFromUrl('https://img/album.jpg') }),
      streamables: [serverStreamable('https://cdn/stream.wav', 1, 'Track')],
    });
    const json = mediaView(track, ctx.issueUrl) as Record<string, Json>;
    const artists = json.artists as Record<string, Json>[];
    expect(artists[0]?.mediaItemType).toBeUndefined();
    expect(ctx.urls).not.toContain('https://img/artist.jpg');
    expect(ctx.urls).not.toContain('https://img/album.jpg');
    expect((json.isPlayable as Record<string, Json>).type).toBe(`${MODEL}Track.Playable.Yes`);
    expect((json.streamables as Record<string, Json>[])[0]?.type).toBe('Server');
  });

  it('a no-stream track reports the reason in its playable type', () => {
    const json = mediaView(
      makeTrack({ id: 'x', title: 'x', isPlayable: { kind: 'No', reason: 'Album Required' } }),
      () => undefined,
    ) as Record<string, Json>;
    expect(json.isPlayable).toEqual({ type: `${MODEL}Track.Playable.No`, reason: 'Album Required' });
  });

  it('radio omits background and isRadioSupported, as Kotlin does', () => {
    const json = mediaView(
      { kind: 'Radio', id: 'r', title: 'R', cover: null, authors: [], trackCount: null, description: null, subtitle: null, extras: {}, isFollowable: false, isSaveable: false, isLikeable: false, isHideable: false, isShareable: true } satisfies EchoMediaItem,
      () => undefined,
    ) as Record<string, Json>;
    expect('background' in json).toBe(false);
    expect('isRadioSupported' in json).toBe(false);
  });

  it('a playlist keeps isPrivate and isEditable', () => {
    const json = mediaView(
      makePlaylist({ id: 'p', title: 'P', isEditable: true, isPrivate: false }),
      () => undefined,
    ) as Record<string, Json>;
    expect(json.isEditable).toBe(true);
    expect(json.isPrivate).toBe(false);
  });
});

describe('shelf, feed, page and other views', () => {
  it('an item shelf uses the media title (Artist: its name)', () => {
    const ctx = recorder();
    const shelf: Shelf = { shelfKind: 'Item', media: makeArtist({ id: 'a', name: 'Voice' }) };
    const json = shelfView(shelf, ctx) as Record<string, Json>;
    expect(json.kind).toBe('item');
    expect(json.title).toBe('Voice');
    expect(json.items).toBeNull();
  });

  it('an items shelf registers its more feed and reports horizontal from the layout', () => {
    const ctx = recorder();
    const more = feedOfPaged(PagedData.single<Shelf>(() => Promise.resolve([])));
    const shelf: Shelf = {
      shelfKind: 'Items',
      id: 'all',
      title: 'All',
      list: [makeAlbum({ id: '1', title: 'A' })],
      subtitle: null,
      layout: 'Grid',
      more,
      extras: {},
    };
    const json = shelfView(shelf, ctx) as Record<string, Json>;
    expect(json.kind).toBe('items');
    expect(json.horizontal).toBe(false);
    expect(json.moreFeedId).toBe('feed-1');
    expect(ctx.feeds).toBe(1);
  });

  it('the empty feed is the Kotlin default FeedDto', () => {
    expect(feedView(null, recorder())).toEqual({
      feedId: null,
      pagedId: null,
      tabs: [],
      selectedTab: null,
      showSearch: true,
      showSort: true,
      showPlayAndShuffle: false,
      background: null,
      customTracks: null,
    });
  });

  it('a page uses its item kind to pick the view', () => {
    const ctx = recorder();
    const items = [
      { shelfKind: 'Item', media: makeAlbum({ id: '1', title: 'A' }) } satisfies Shelf,
      makeAlbum({ id: '2', title: 'B' }),
      { id: 'L', title: 'Song', subtitle: null, lyrics: null, extras: {} },
    ] as const;
    const json = pageView(items, '5', ctx) as Record<string, Json>;
    const out = json.items as Record<string, Json>[];
    expect(out[0]?.kind).toBe('item');
    expect(out[1]?.mediaItemType).toBe(`${MODEL}Album`);
    expect(out[2]?.lyrics).toBeNull();
    expect(json.continuation).toBe('5');
  });

  it('settings render with explicit nulls', () => {
    const json = settingView({
      kind: 'list',
      key: 'siteMirror',
      title: 'Site Mirror',
      summary: null,
      options: [{ title: 'asmr-100', value: 'asmr-100' }],
      value: 'asmr-100',
      min: null,
      max: null,
      steps: null,
      children: null,
    }) as Record<string, Json>;
    expect(json.summary).toBeNull();
    expect(json.children).toBeNull();
    expect(json.options).toEqual([{ title: 'asmr-100', value: 'asmr-100' }]);
  });

  it('quick-search query and media items use their discriminators', () => {
    const json = quickSearchView([
      { kind: 'Query', query: 'q', searched: false, extras: {} },
      { kind: 'Media', media: makeAlbum({ id: '1', title: 'A' }), searched: true },
    ]) as Record<string, Json>[];
    expect(json[0]?.quickSearchItemType).toBe(`${MODEL}QuickSearchItem.Query`);
    expect(json[1]?.quickSearchItemType).toBe(`${MODEL}QuickSearchItem.Media`);
  });
});
