import type { Dispatcher } from 'undici';
import { NotSupportedException } from '../../models/errors.js';
import type {
  Album,
  Artist,
  EchoMediaItem,
  Playlist,
  Radio,
  Track,
} from '../../models/echo/media.js';
import type { Lyrics } from '../../models/echo/lyrics.js';
import type { QuickSearchItem } from '../../models/echo/quick-search.js';
import type { Settings, Setting } from '../../models/echo/settings.js';
import type { StreamMedia, Streamable } from '../../models/echo/streamable.js';
import type { Shelf, ShelfCategory } from '../../models/echo/shelf.js';
import type { User } from '../../models/echo/common.js';
import { feedOfPaged, type Feed } from '../../models/feed.js';
import type { LoginForm, MusicExtension } from '../../models/extension.js';
import { PagedData } from '../../models/paged-data.js';
import { languageForCode } from '../asmrone/languages.js';
import { TitleTranslator } from '../jasmr/translation.js';
import { JnetClient } from './api/jnet.client.js';
import {
  homeSchema,
  searchSchema,
  tagsSchema,
  videoSchema,
  type Localized,
  type Video,
  type WorkSummary,
} from './api/schemas.js';
import {
  APP_USER_AGENT,
  JNET_SITE,
  circleNameOf,
  decodeStreamId,
  workCodeOf,
} from './constants.js';
import { browseCategory, categoriesShelf, itemShelf, itemsShelf } from '../common/shelves.js';
import {
  plainDescription,
  pickText,
  summaryToAlbum,
  videoToAlbum,
  videoToTracks,
} from './mappers.js';

/** Works per page of search results (the site's own page size). */
const PAGE_SIZE = 24;
/** Tags shown on the home screen, most used first. */
const HOME_TAGS = 40;
const QUICK_SEARCH_LIMIT = 8;

export interface JnetExtensionOptions {
  readonly gapMs: number;
  readonly cacheTtlMs: number;
  /** Replaces the translator (tests). */
  readonly translator?: TitleTranslator;
}

interface SearchParams {
  readonly search?: string;
  readonly sort: 'relevanceDescending' | 'dateDescending' | 'likesDescending' | 'viewsDescending';
}

/**
 * jasmr.net as a music extension, through its JSON API. Works are albums, tracks are chapters of the
 * work's one audio file, circles are artists. Login, library, playlists, likes, radio and the
 * site's own lyrics are not offered: AI subtitles are made locally instead.
 */
export class JnetExtension implements MusicExtension {
  readonly loginForms: readonly LoginForm[] = [];
  private readonly client: JnetClient;
  private readonly translator: TitleTranslator;
  private settings: Settings | null = null;

  constructor(dispatcher: Dispatcher, options: JnetExtensionOptions) {
    this.client = new JnetClient(dispatcher, {
      gapMs: options.gapMs,
      cacheTtlMs: options.cacheTtlMs,
    });
    this.translator = options.translator ?? new TitleTranslator(() => this.settings);
  }

  // lifecycle and settings: the translation switch and language are shared with Japanese ASMR
  onInitialize(): Promise<void> {
    return Promise.resolve();
  }

  onExtensionSelected(): Promise<void> {
    return Promise.resolve();
  }

  setSettings(settings: Settings): void {
    this.settings = settings;
  }

  getSettingItems(): Promise<readonly Setting[]> {
    return Promise.resolve([]);
  }

  // feeds
  loadHomeFeed(): Promise<Feed<Shelf>> {
    return Promise.resolve(feedOfPaged(PagedData.single<Shelf>(() => this.homeShelves())));
  }

  loadLibraryFeed(): Promise<Feed<Shelf>> {
    return Promise.reject(new NotSupportedException('library'));
  }

  loadSearchFeed(query: string): Promise<Feed<Shelf>> {
    return Promise.resolve(this.searchFeed({ search: query, sort: 'relevanceDescending' }));
  }

  async quickSearch(query: string): Promise<QuickSearchItem[]> {
    const { albums } = await this.searchPage(
      { search: query, sort: 'relevanceDescending' },
      1,
      QUICK_SEARCH_LIMIT,
    );
    return albums.map((media) => ({ kind: 'Media', media, searched: false }));
  }

  // albums, artists, playlists
  async loadAlbum(album: Album): Promise<Album> {
    return (await this.work(workCodeOf(album.id))).album;
  }

  async loadAlbumFeed(album: Album): Promise<Feed<Shelf> | null> {
    const video = await this.video(workCodeOf(album.id));
    const related = video.related ?? [];
    if (related.length === 0) return null;
    const albums = await this.summaryAlbums(related);
    return feedOfPaged(
      PagedData.single<Shelf>(() => Promise.resolve([itemsShelf('related', 'Related', albums)])),
    );
  }

  loadAlbumTracks(album: Album): Promise<Feed<Track> | null> {
    return Promise.resolve(
      feedOfPaged(
        PagedData.single<Track>(async () => {
          const { video, album: work, trackTitles } = await this.work(workCodeOf(album.id));
          return videoToTracks(video, work, trackTitles);
        }),
      ),
    );
  }

  loadArtist(artist: Artist): Promise<Artist> {
    return Promise.resolve(artist);
  }

  loadArtistFeed(artist: Artist): Promise<Feed<Shelf>> {
    const name = circleNameOf(artist.id);
    if (name === null) return Promise.resolve(feedOfPaged(PagedData.empty<Shelf>()));
    return Promise.resolve(this.searchFeed({ search: `+"${name}"`, sort: 'dateDescending' }));
  }

  loadPlaylist(_playlist: Playlist): Promise<Playlist> {
    return Promise.reject(new NotSupportedException('playlists'));
  }

  loadPlaylistFeed(_playlist: Playlist): Promise<Feed<Shelf> | null> {
    return Promise.reject(new NotSupportedException('playlists'));
  }

  loadPlaylistTracks(_playlist: Playlist): Promise<Feed<Track>> {
    return Promise.reject(new NotSupportedException('playlists'));
  }

  // tracks and streams
  loadTrack(track: Track): Promise<Track> {
    return Promise.resolve(track);
  }

  loadStreamableMedia(streamable: Streamable): Promise<StreamMedia> {
    const url = decodeStreamId(streamable.id);
    if (url === null) return Promise.reject(new Error('This stream cannot be opened.'));
    return Promise.resolve({
      mediaKind: 'Server',
      sources: [
        {
          sourceKind: 'Http',
          request: {
            url,
            headers: { 'User-Agent': APP_USER_AGENT },
            method: 'GET',
            bodyBase64: null,
          },
          type: 'Progressive',
          decryption: null,
          quality: 0,
          title: null,
          isVideo: false,
          isLive: false,
        },
      ],
      merged: false,
    });
  }

  // lyrics: none on this site; AI subtitles are made on this computer instead
  searchTrackLyrics(_track: Track): Promise<Feed<Lyrics>> {
    return Promise.resolve(feedOfPaged(PagedData.empty<Lyrics>()));
  }

  loadLyrics(_lyrics: Lyrics): Promise<Lyrics> {
    return Promise.reject(new NotSupportedException('lyrics'));
  }

  // radio
  radio(_item: EchoMediaItem, _context: EchoMediaItem | null): Promise<Radio> {
    return Promise.reject(new NotSupportedException('radio'));
  }

  loadRadio(_radio: Radio): Promise<Radio> {
    return Promise.reject(new NotSupportedException('radio'));
  }

  loadRadioTracks(_radio: Radio): Promise<Feed<Track>> {
    return Promise.reject(new NotSupportedException('radio'));
  }

  // sharing and likes
  onShare(item: EchoMediaItem): Promise<string> {
    return Promise.resolve(`${JNET_SITE}/search?q=${encodeURIComponent(workCodeOf(item.id))}`);
  }

  likeItem(_item: EchoMediaItem, _shouldLike: boolean): Promise<void> {
    return Promise.reject(new NotSupportedException('likes'));
  }

  isItemLiked(_item: EchoMediaItem): Promise<boolean> {
    return Promise.resolve(false);
  }

  // playlist editing: none
  listEditablePlaylists(_track: Track | null): Promise<Array<readonly [Playlist, boolean]>> {
    return Promise.resolve([]);
  }

  createPlaylist(_title: string, _description: string | null): Promise<Playlist> {
    return Promise.reject(new NotSupportedException('playlists'));
  }

  deletePlaylist(_playlist: Playlist): Promise<void> {
    return Promise.reject(new NotSupportedException('playlists'));
  }

  editPlaylistMetadata(
    _playlist: Playlist,
    _title: string,
    _description: string | null,
  ): Promise<void> {
    return Promise.reject(new NotSupportedException('playlists'));
  }

  setPrivacy(_playlist: Playlist, _isPrivate: boolean): Promise<void> {
    return Promise.reject(new NotSupportedException('playlists'));
  }

  addTracksToPlaylist(
    _playlist: Playlist,
    _tracks: readonly Track[],
    _index: number,
    _added: readonly Track[],
  ): Promise<void> {
    return Promise.reject(new NotSupportedException('playlists'));
  }

  removeTracksFromPlaylist(
    _playlist: Playlist,
    _tracks: readonly Track[],
    _indexes: readonly number[],
  ): Promise<void> {
    return Promise.reject(new NotSupportedException('playlists'));
  }

  // account: none
  onLogin(_key: string, _data: Readonly<Record<string, string | null>>): Promise<User[]> {
    return Promise.reject(new NotSupportedException('login'));
  }

  setLoginUser(_user: User | null): void {
    // No accounts.
  }

  getCurrentUser(): Promise<User | null> {
    return Promise.resolve(null);
  }

  // ----- helpers -----

  private languageCode(): string {
    return languageForCode(this.settings?.getString('translationLanguage') ?? null).code;
  }

  /**
   * The text to show for each localized value, in order. Pieces the site doesn't translate into the
   * chosen language go through the shared translator, in one batch.
   */
  private async texts(values: readonly (Localized | null | undefined)[]): Promise<string[]> {
    const code = this.languageCode();
    const picks = values.map((value) => pickText(value, code));
    const pending = picks.filter((pick) => pick.needsTranslation).map((pick) => pick.text);
    const translated =
      pending.length > 0 ? await this.translator.lookup(pending) : (text: string) => text;
    return picks.map((pick) => (pick.needsTranslation ? translated(pick.text) : pick.text));
  }

  private async homeShelves(): Promise<Shelf[]> {
    const home = homeSchema.parse(await this.client.json('/api/v1/home'));
    const shelves: Shelf[] = [];
    for (const bucket of home.buckets) {
      const albums = await this.summaryAlbums(bucket.videos);
      if (albums.length > 0) shelves.push(itemsShelf(`bucket:${bucket.key}`, bucket.title, albums));
    }

    const latest: SearchParams = { sort: 'dateDescending' };
    const liked: SearchParams = { sort: 'likesDescending' };
    const latestFirst = await this.searchPage(latest, 1);
    shelves.push(itemsShelf('latest', 'Latest', latestFirst.albums, this.searchFeed(latest)));
    const likedFirst = await this.searchPage(liked, 1);
    shelves.push(itemsShelf('liked', 'Most liked', likedFirst.albums, this.searchFeed(liked)));

    const tags = tagsSchema.parse(await this.client.json('/api/v1/tags'));
    const top = [...tags]
      .sort((a, b) => (b.videoCount ?? 0) - (a.videoCount ?? 0))
      .slice(0, HOME_TAGS);
    const titles = await this.texts(top.map((tag) => tag.name));
    const categories: ShelfCategory[] = top.map((tag, i) =>
      browseCategory(
        `tag:${tag.id}`,
        titles[i] || `Tag ${tag.id}`,
        this.searchFeed({ search: titles[i] || '', sort: 'relevanceDescending' }),
        `${tag.videoCount ?? 0}`,
      ),
    );
    if (categories.length > 0)
      shelves.push(categoriesShelf('tags', 'Tags', categories, 'By number of works'));
    return shelves;
  }

  /** A continuous feed of search results, one item per work. */
  private searchFeed(params: SearchParams): Feed<Shelf> {
    return feedOfPaged(
      PagedData.continuous<Shelf>(async (continuation) => {
        const page = continuation === null ? 1 : Number(continuation);
        const { albums, total } = await this.searchPage(params, page);
        return {
          data: albums.map(itemShelf),
          continuation: page * PAGE_SIZE < total ? String(page + 1) : null,
        };
      }),
    );
  }

  private async searchPage(
    params: SearchParams,
    page: number,
    limit = PAGE_SIZE,
  ): Promise<{ albums: Album[]; total: number }> {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      r18: 'true',
      r15: 'true',
      all: 'true',
      type: 'video',
      date: 'alltime',
      min: '0',
      max: '6000',
      tracks: 'false',
      exclude: '',
      search: params.search ?? '',
      sort: params.sort,
    });
    const result = searchSchema.parse(await this.client.json(`/api/v1/search?${query.toString()}`));
    return { albums: await this.summaryAlbums(result.results), total: result.totalCount };
  }

  /** Works from a list as albums, with their titles in the chosen language. */
  private async summaryAlbums(works: readonly WorkSummary[]): Promise<Album[]> {
    const titles = await this.texts(works.map((work) => work.title));
    return works.map((work, i) =>
      summaryToAlbum(work, {
        title: titles[i] || work.rjCode,
        originalTitle: work.title?.japanese || titles[i] || work.rjCode,
      }),
    );
  }

  private async video(code: string): Promise<Video> {
    return videoSchema.parse(
      await this.client.json(`/api/v1/videos?code=${encodeURIComponent(code)}`),
    );
  }

  /** A work with its album (localized title, description) and the titles of its tracks. */
  private async work(code: string): Promise<{ video: Video; album: Album; trackTitles: string[] }> {
    const video = await this.video(code);
    const [title, description, ...trackTitles] = await this.texts([
      video.title,
      video.description,
      ...(video.tracks ?? []).map((track) => track.title),
    ]);
    const shownTitle = title || video.rjCode;
    const album = videoToAlbum(
      video,
      { title: shownTitle, originalTitle: video.title.japanese || shownTitle },
      plainDescription(description ?? '') || null,
    );
    return { video, album, trackTitles };
  }
}
