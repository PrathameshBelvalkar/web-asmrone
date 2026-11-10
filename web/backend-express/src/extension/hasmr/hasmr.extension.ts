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
import { TitleTranslator } from '../jasmr/translation.js';
import { HasmrClient } from './api/hasmr.client.js';
import {
  APP_USER_AGENT,
  HASMR_SITE,
  actorArtistId,
  categoryArtistId,
  decodeStreamId,
  workSlugOf,
} from './constants.js';
import { cardToAlbum, workToAlbum, workToTracks } from './mappers.js';
import { parseListing, type HasmrCard } from './parsers/listing.js';
import { parseActorList, parseTagCloud } from './parsers/index.js';
import { parseWork } from './parsers/work.js';
import { browseCategory, categoriesShelf, itemShelf, itemsShelf } from '../common/shelves.js';

const ROW_SIZE = 40;
const QUICK_SEARCH_LIMIT = 8;
/** The site's own categories (its menu), each a listing page. */
const CATEGORIES: readonly { readonly slug: string; readonly title: string }[] = [
  { slug: 'otome', title: 'Otome / 乙女' },
  { slug: 'erovoice', title: 'Erovoice / エロボイス' },
  { slug: 'english', title: 'English' },
  { slug: 'chinese', title: 'Chinese / 中国語' },
];

export interface HasmrExtensionOptions {
  readonly gapMs: number;
  readonly cacheTtlMs: number;
  /** Replaces the translator (tests). */
  readonly translator?: TitleTranslator;
}

/**
 * hentaiasmr.moe as a music extension, through its public pages. Works are albums, each MP3 is a
 * track, circles and cast are artists. Login, library, playlists, likes, radio and the site's lyrics
 * are not offered: AI subtitles are made on this computer instead.
 */
export class HasmrExtension implements MusicExtension {
  readonly loginForms: readonly LoginForm[] = [];
  private readonly client: HasmrClient;
  private readonly translator: TitleTranslator;
  private settings: Settings | null = null;

  constructor(dispatcher: Dispatcher, options: HasmrExtensionOptions) {
    this.client = new HasmrClient(dispatcher, {
      gapMs: options.gapMs,
      cacheTtlMs: options.cacheTtlMs,
    });
    this.translator = options.translator ?? new TitleTranslator(() => this.settings);
  }

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

  // feeds: the home screen loads one row per page of its feed, as the user scrolls
  loadHomeFeed(): Promise<Feed<Shelf>> {
    return Promise.resolve(
      feedOfPaged(
        PagedData.continuous<Shelf>(async (continuation) => {
          const row = continuation ?? 'start';
          const next = HOME_ROWS.indexOf(row as (typeof HOME_ROWS)[number]) + 1;
          const data = await this.homeRow(row);
          return { data, continuation: HOME_ROWS[next] ?? null };
        }),
      ),
    );
  }

  loadLibraryFeed(): Promise<Feed<Shelf>> {
    return Promise.reject(new NotSupportedException('library'));
  }

  loadSearchFeed(query: string): Promise<Feed<Shelf>> {
    return Promise.resolve(this.listingFeed(`/?s=${encodeURIComponent(query)}`));
  }

  async quickSearch(query: string): Promise<QuickSearchItem[]> {
    const { cards } = parseListing(
      await this.client.page(`/?s=${encodeURIComponent(query)}`),
      HASMR_SITE,
    );
    const albums = await this.cardAlbums(cards.slice(0, QUICK_SEARCH_LIMIT));
    return albums.map((media) => ({ kind: 'Media', media, searched: false }));
  }

  // albums, artists
  async loadAlbum(album: Album): Promise<Album> {
    return (await this.work(workSlugOf(album.id))).album;
  }

  async loadAlbumFeed(album: Album): Promise<Feed<Shelf> | null> {
    const slug = workSlugOf(album.id);
    const html = await this.client.page(`/${slug}.html`);
    const related = parseListing(html, HASMR_SITE).cards.filter((card) => card.slug !== slug);
    if (related.length === 0) return null;
    const albums = await this.cardAlbums(related);
    return feedOfPaged(
      PagedData.single<Shelf>(() => Promise.resolve([itemsShelf('related', 'Related', albums)])),
    );
  }

  loadAlbumTracks(album: Album): Promise<Feed<Track> | null> {
    return Promise.resolve(
      feedOfPaged(
        PagedData.single<Track>(async () => {
          const slug = workSlugOf(album.id);
          const { work, album: shown } = await this.work(slug);
          return workToTracks(work, shown, slug);
        }),
      ),
    );
  }

  loadArtist(artist: Artist): Promise<Artist> {
    return Promise.resolve(artist);
  }

  loadArtistFeed(artist: Artist): Promise<Feed<Shelf>> {
    if (artist.id.startsWith(actorArtistId(''))) {
      return Promise.resolve(
        this.listingFeed(`/actor/${artist.id.slice(actorArtistId('').length)}`),
      );
    }
    const prefix = categoryArtistId('');
    if (artist.id.startsWith(prefix)) {
      return Promise.resolve(this.listingFeed(`/category/${artist.id.slice(prefix.length)}`));
    }
    return Promise.resolve(feedOfPaged(PagedData.empty<Shelf>()));
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
          // The audio host answers the player's own request headers. Nothing is faked beyond that.
          request: {
            url,
            headers: { Referer: `${HASMR_SITE}/`, Accept: '*/*', 'User-Agent': APP_USER_AGENT },
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
    return Promise.resolve(`${HASMR_SITE}/${workSlugOf(item.id)}.html`);
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

  /** One row of the home screen. */
  private async homeRow(row: string): Promise<Shelf[]> {
    switch (row) {
      case 'start': {
        const { cards, nextUrl } = parseListing(await this.client.page('/'), HASMR_SITE);
        const latest = await this.cardAlbums(cards);
        const categories = CATEGORIES.map((c) =>
          browseCategory(`category:${c.slug}`, c.title, this.listingFeed(`/category/${c.slug}`)),
        );
        return [
          itemsShelf('latest', 'Latest', latest, nextUrl ? this.listingFeed('/') : null),
          categoriesShelf('categories', 'Categories', categories),
        ];
      }
      case 'weekly':
        return [await this.listingRow('weekly', 'Popular this week', '/今週人気の')];
      case 'popular':
        return [await this.listingRow('popular', 'Popular', '/?filter=popular')];
      case 'viewed':
        return [await this.listingRow('viewed', 'Most viewed', '/?filter=most-viewed')];
      case 'tags': {
        const tags = parseTagCloud(await this.client.page('/tags')).slice(0, ROW_SIZE);
        const titles = await this.translate(tags.map((t) => t.name));
        const chips: ShelfCategory[] = tags.map((tag, i) =>
          browseCategory(
            `tag:${tag.slug}`,
            titles[i] ?? tag.name,
            this.listingFeed(`/tag/${tag.slug}`),
          ),
        );
        return chips.length > 0 ? [categoriesShelf('tags', 'Tags', chips, 'Most used first')] : [];
      }
      case 'actors': {
        const actors = parseActorList(await this.client.page('/voice-actors')).slice(0, ROW_SIZE);
        const chips: ShelfCategory[] = actors.map((actor) =>
          browseCategory(
            `actor:${actor.slug}`,
            actor.name,
            this.listingFeed(`/actor/${actor.slug}`),
          ),
        );
        return chips.length > 0 ? [categoriesShelf('actors', 'Voice actors', chips)] : [];
      }
      default:
        return [];
    }
  }

  /** A row of works from one listing page, with "See all" going through the whole listing. */
  private async listingRow(id: string, title: string, path: string): Promise<Shelf> {
    const { cards } = parseListing(await this.client.page(path), HASMR_SITE);
    const albums = await this.cardAlbums(cards);
    return itemsShelf(id, title, albums, this.listingFeed(path));
  }

  /** Every work on a listing, page by page, starting at `start` (a site path or full address). */
  private listingFeed(start: string): Feed<Shelf> {
    return feedOfPaged(
      PagedData.continuous<Shelf>(async (continuation) => {
        const address = continuation ?? start;
        const { cards, nextUrl } = parseListing(await this.client.page(address), HASMR_SITE);
        const albums = await this.cardAlbums(cards);
        return { data: albums.map(itemShelf), continuation: nextUrl };
      }),
    );
  }

  private async cardAlbums(cards: readonly HasmrCard[]): Promise<Album[]> {
    const titles = await this.translate(cards.map((card) => card.title));
    return cards.map((card, i) => cardToAlbum(card, titles[i] ?? card.title));
  }

  /** Titles in the chosen language, translated in one batch (the site's titles are Japanese). */
  private async translate(texts: readonly string[]): Promise<string[]> {
    const lookup = await this.translator.lookup(texts);
    return texts.map((text) => lookup(text));
  }

  private async work(slug: string): Promise<{ work: ReturnType<typeof parseWork>; album: Album }> {
    const work = parseWork(await this.client.page(`/${slug}.html`), HASMR_SITE);
    const original = work.title ?? slug.toUpperCase();
    const [title] = await this.translate([original]);
    return { work, album: workToAlbum(work, slug, title ?? original, original) };
  }
}

const HOME_ROWS = ['start', 'weekly', 'popular', 'viewed', 'tags', 'actors'] as const;
