import type { Dispatcher } from 'undici';
import { NotSupportedException } from '../../models/errors.js';
import type { Album, Artist, EchoMediaItem, Playlist, Radio, Track } from '../../models/echo/media.js';
import type { Lyrics } from '../../models/echo/lyrics.js';
import type { QuickSearchItem } from '../../models/echo/quick-search.js';
import type { Settings, Setting } from '../../models/echo/settings.js';
import type { StreamMedia, Streamable } from '../../models/echo/streamable.js';
import type { Shelf } from '../../models/echo/shelf.js';
import type { User } from '../../models/echo/common.js';
import { feedOfPaged, type Feed } from '../../models/feed.js';
import type { LoginForm, MusicExtension } from '../../models/extension.js';
import { PagedData } from '../../models/paged-data.js';
import { JasmrClient } from './api/jasmr.client.js';
import {
  JASMR_REFERER,
  JASMR_SITE,
  decodeStreamId,
  parseArtistId,
  workIdOf,
} from './constants.js';
import { browseCategory, cardToAlbum, categoriesShelf, itemShelf, itemsShelf, postToAlbum, postToTracks } from './mappers.js';
import { parseListing, type Listing, type ListingCard } from './parsers/listing.js';
import { parsePost, type Post } from './parsers/post.js';

/** Browse entries on the home screen: each is a listing of a category or tag page. */
const BROWSE: readonly { readonly id: string; readonly title: string; readonly path: string }[] = [
  { id: 'rating-sfw', title: 'SFW / 全年齢', path: '/category/rating/sfw/' },
  { id: 'rating-r15', title: 'R-15', path: '/category/rating/r-15/' },
  { id: 'rating-nsfw', title: 'NSFW / R18', path: '/category/rating/maniax/' },
  { id: 'yuri', title: 'Yuri / 百合', path: '/tag/yuri-girls-love/' },
  { id: 'futanari', title: 'Futanari / フタナリ', path: '/category/futanari/' },
  { id: 'otokonoko', title: 'Otoko no ko / 男の娘', path: '/category/otokonoko/' },
];

const SEEN_LIMIT = 3000;
const QUICK_SEARCH_LIMIT = 8;

export interface JasmrExtensionOptions {
  readonly crawlDelayMs: number;
  readonly cacheTtlMs: number;
}

/**
 * japaneseasmr.com as a music extension. Works are albums, chapters are tracks, circles are artists.
 * Features the site does not offer (login, library, playlists, likes, radio, lyrics) are not supported.
 *
 * Site search is not used: the site's search page sits behind a bot check. Search and quick search
 * instead match the works from the listing pages this process has already loaded.
 */
export class JasmrExtension implements MusicExtension {
  readonly loginForms: readonly LoginForm[] = [];
  private readonly client: JasmrClient;
  /** Works seen on listing pages and on loaded work pages, for search. Oldest dropped past SEEN_LIMIT. */
  private readonly seen = new Map<string, Album>();

  constructor(dispatcher: Dispatcher, options: JasmrExtensionOptions) {
    this.client = new JasmrClient(dispatcher, { crawlDelayMs: options.crawlDelayMs, cacheTtlMs: options.cacheTtlMs });
  }

  // lifecycle and settings: none for this source
  onInitialize(): Promise<void> {
    return Promise.resolve();
  }

  onExtensionSelected(): Promise<void> {
    return Promise.resolve();
  }

  setSettings(_settings: Settings): void {
    // No settings.
  }

  getSettingItems(): Promise<readonly Setting[]> {
    return Promise.resolve([]);
  }

  // feeds
  loadHomeFeed(): Promise<Feed<Shelf>> {
    return Promise.resolve(
      feedOfPaged(
        PagedData.single<Shelf>(async () => {
          const first = await this.listing('/', 1);
          const albums = first.cards.map((card) => this.remember(card));
          const more = first.nextPage === null ? null : this.listingFeed('/', 2);
          const browse = BROWSE.map((entry) => browseCategory(entry.id, entry.title, this.listingFeed(entry.path)));
          return [itemsShelf('latest', 'Latest', albums, more), categoriesShelf('browse', 'Browse', browse)];
        }),
      ),
    );
  }

  loadLibraryFeed(): Promise<Feed<Shelf>> {
    return Promise.reject(new NotSupportedException('library'));
  }

  loadSearchFeed(query: string): Promise<Feed<Shelf>> {
    return Promise.resolve(
      feedOfPaged(
        PagedData.single<Shelf>(async () => {
          // Load the first listing so there is something to match, then filter what is known.
          await this.listing('/', 1);
          return this.matching(query).map(itemShelf);
        }),
      ),
    );
  }

  quickSearch(query: string): Promise<QuickSearchItem[]> {
    return Promise.resolve(this.matching(query).slice(0, QUICK_SEARCH_LIMIT).map((media) => ({ kind: 'Media', media, searched: false })));
  }

  // albums, artists, playlists
  async loadAlbum(album: Album): Promise<Album> {
    const full = postToAlbum(await this.post(workIdOf(album.id)));
    this.see(full);
    return full;
  }

  loadAlbumFeed(_album: Album): Promise<Feed<Shelf> | null> {
    return Promise.resolve(null);
  }

  loadAlbumTracks(album: Album): Promise<Feed<Track> | null> {
    return Promise.resolve(
      feedOfPaged(
        PagedData.single<Track>(async () => {
          const post = await this.post(workIdOf(album.id));
          return postToTracks(post, postToAlbum(post));
        }),
      ),
    );
  }

  loadArtist(artist: Artist): Promise<Artist> {
    return Promise.resolve(artist);
  }

  loadArtistFeed(artist: Artist): Promise<Feed<Shelf>> {
    const slug = parseArtistId(artist.id);
    if (slug === null) return Promise.resolve(feedOfPaged(PagedData.empty<Shelf>()));
    return Promise.resolve(this.listingFeed(`/category/${slug}/`));
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
          request: { url, headers: { Referer: JASMR_REFERER }, method: 'GET', bodyBase64: null },
          type: 'HLS',
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

  // lyrics: none on this site, so the feed is empty and the app shows no lyrics
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
    return Promise.resolve(`${JASMR_SITE}/${workIdOf(item.id)}/`);
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

  editPlaylistMetadata(_playlist: Playlist, _title: string, _description: string | null): Promise<void> {
    return Promise.reject(new NotSupportedException('playlists'));
  }

  setPrivacy(_playlist: Playlist, _isPrivate: boolean): Promise<void> {
    return Promise.reject(new NotSupportedException('playlists'));
  }

  addTracksToPlaylist(_playlist: Playlist, _tracks: readonly Track[], _index: number, _added: readonly Track[]): Promise<void> {
    return Promise.reject(new NotSupportedException('playlists'));
  }

  removeTracksFromPlaylist(_playlist: Playlist, _tracks: readonly Track[], _indexes: readonly number[]): Promise<void> {
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

  /** A listing as a feed of single-item shelves, one page at a time. */
  private listingFeed(base: string, firstPage = 1): Feed<Shelf> {
    return feedOfPaged(
      PagedData.continuous<Shelf>(async (continuation) => {
        const page = continuation === null ? firstPage : Number(continuation);
        const listing = await this.listing(base, page);
        return {
          data: listing.cards.map((card) => itemShelf(this.remember(card))),
          continuation: listing.nextPage === null ? null : String(listing.nextPage),
        };
      }),
    );
  }

  private async listing(base: string, page: number): Promise<Listing> {
    const path = page === 1 ? base : `${base}page/${page}/`;
    return parseListing(await this.client.page(path), page);
  }

  private async post(workId: string): Promise<Post> {
    return parsePost(await this.client.page(`/${workId}/`), workId);
  }

  private remember(card: ListingCard): Album {
    const album = cardToAlbum(card);
    this.see(album);
    return album;
  }

  private see(album: Album): void {
    this.seen.delete(album.id);
    this.seen.set(album.id, album);
    if (this.seen.size > SEEN_LIMIT) {
      const oldest = this.seen.keys().next();
      if (!oldest.done) this.seen.delete(oldest.value);
    }
  }

  private matching(query: string): EchoMediaItem[] {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];
    const matches: Album[] = [];
    // Most recently seen first.
    for (const album of [...this.seen.values()].reverse()) {
      const haystack = [album.title, album.subtitle ?? '', album.extras.rjCode ?? ''].join(' ').toLowerCase();
      if (haystack.includes(q)) matches.push(album);
    }
    return matches;
  }


}
