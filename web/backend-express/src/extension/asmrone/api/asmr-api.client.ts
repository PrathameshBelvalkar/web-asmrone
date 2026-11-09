import { randomUUID } from 'node:crypto';
import type { Dispatcher } from 'undici';
import { z } from 'zod';
import { appLogger } from '../../../lib/app-logger.js';
import { LruCache } from '../../../lib/lru-cache.js';
import { httpCall } from '../../../lib/http-client.js';
import type { Settings } from '../../../models/echo/settings.js';
import { encodeKeyword, sortByText } from '../util/text.js';
import { languageForCode, type TranslationLanguage } from '../languages.js';
import { applyTranslations, deepCopy, getAllTitles, type FolderNode } from '../media-tree/tree.js';
import { translateList } from '../translation/translate-list.js';
import { translateText } from '../translation/gtx-translator.js';
import { moveFirstGroupToEnd } from '../translation/title.js';
import {
  asmrPlaylistSchema,
  loginResponseSchema,
  playlistsResponseSchema,
  rawNodeSchema,
  tagSchema,
  toRootFolder,
  workSchema,
  worksResponseSchema,
  type AsmrPlaylist,
  type Tag,
  type Work,
  type WorksResponse,
  type Pagination,
} from './upstream.schemas.js';

export const DEFAULT_MIRROR = 'asmr-100';
const API_HOST = 'https://api.asmr.one/api';

export type SortOrder =
  | 'release' | 'create_date' | 'rating' | 'price' | 'rate_average_2dp' | 'review_count' | 'id' | 'nsfw' | 'random';
export type SortType = 'asc' | 'desc';

export interface LoginResult {
  readonly name: string;
  readonly recommenderUuid: string;
  readonly token: string;
}

/**
 * HTTP client for the asmr.one API. Holds the logged-in user and the caches. Each method maps to
 * one endpoint of the Kotlin AsmrApi. Filters and translation are applied as in Kotlin.
 */
export class AsmrApiClient {
  private uuid: string = randomUUID();
  private token: string | null = null;
  private tagsCache: { readonly key: string; readonly tags: readonly Tag[] } | null = null;
  private readonly treeCache = new LruCache<string, FolderNode>(20);

  constructor(
    private readonly dispatcher: Dispatcher,
    private readonly settings: () => Settings | null,
  ) {}

  updateUser(uuid: string | null, token: string | null): void {
    this.uuid = uuid ?? randomUUID();
    this.token = token;
  }

  // ----- settings helpers -----

  mirror(): string {
    return this.settings()?.getString('siteMirror') ?? DEFAULT_MIRROR;
  }

  baseUrl(): string {
    return `https://api.${this.mirror()}.com/api`;
  }

  language(): TranslationLanguage {
    return languageForCode(this.settings()?.getString('translationLanguage') ?? null);
  }

  private onlySubtitled(): boolean {
    return this.settings()?.getBoolean('onlyShowSubtitled') === true;
  }

  private sfwOrder(order: SortOrder): SortOrder {
    return this.settings()?.getBoolean('onlyShowSfw') === true ? 'nsfw' : order;
  }

  private sfwSort(sort: SortType): SortType {
    return this.settings()?.getBoolean('onlyShowSfw') === true ? 'asc' : sort;
  }

  // ----- auth -----

  async login(name: string, password: string): Promise<LoginResult> {
    try {
      const parsed = loginResponseSchema.parse(
        await this.send('POST', `${API_HOST}/auth/me`, { name, password }),
      );
      return { name: parsed.user.name, recommenderUuid: parsed.user.recommenderUuid, token: parsed.token };
    } catch (err) {
      throw new Error(`Failed to login: ${messageOf(err)}`);
    }
  }

  // ----- works -----

  /** Media tree of a work, with titles translated. Cached per (mirror, language, work). */
  async getWorkMediaTree(workId: string): Promise<FolderNode> {
    const language = this.language();
    const key = `${this.mirror()}|${language.code}|${workId}`;
    const cached = this.treeCache.get(key);
    if (cached) return deepCopy(cached);

    const raw = z.array(rawNodeSchema).parse(
      await this.send('GET', `${this.baseUrl()}/tracks/${workId}?v=1`),
    );
    const root = toRootFolder(raw);
    await translateFolder(root, language);
    this.treeCache.set(key, deepCopy(root));
    return root;
  }

  async getWork(workId: string): Promise<Work> {
    const work = workSchema.parse(await this.send('GET', `${this.baseUrl()}/workInfo/${workId}`));
    return { ...work, title: await translateWorkTitle(work.title, this.language()) };
  }

  getPopularWorks(page = 1, keyword = ' '): Promise<WorksResponse> {
    return this.postWorks(`${this.baseUrl()}/recommender/popular`, {
      keyword,
      page,
      subtitle: 0,
    });
  }

  getRecommendedWorks(page = 1, keyword = ' '): Promise<WorksResponse> {
    return this.postWorks(`${this.baseUrl()}/recommender/recommend-for-user`, {
      keyword,
      recommenderUuid: this.uuid,
      page,
      subtitle: 0,
    });
  }

  getWorks(page = 1, order: SortOrder = 'release', sort: SortType = 'desc'): Promise<WorksResponse> {
    return this.getFilteredWorks(
      `${this.baseUrl()}/works`,
      { order, sort, page: String(page), subtitle: '0' },
    );
  }

  searchWorks(
    page = 1,
    keyword = ' ',
    order: SortOrder = 'release',
    sort: SortType = 'desc',
    seed = 64,
  ): Promise<WorksResponse> {
    return this.getFilteredWorks(
      `${this.baseUrl()}/search/${encodeKeyword(keyword)}`,
      {
        page: String(page),
        order: this.sfwOrder(order),
        sort: this.sfwSort(sort),
        seed: String(seed),
        subtitle: '0',
        includeTranslationWorks: 'true',
      },
    );
  }

  getRelatedWorks(itemId: string, keyword = ' '): Promise<WorksResponse> {
    return this.postWorks(`${this.baseUrl()}/recommender/item-neighbors`, { keyword, itemId });
  }

  async getFavorites(page = 1, order: SortOrder = 'release', sort: SortType = 'desc'): Promise<WorksResponse> {
    if (this.token === null) return emptyWorks();
    return this.getFilteredWorks(`${this.baseUrl()}/review`, {
      order,
      sort,
      page: String(page),
    });
  }

  async getPlaylistWorks(playlistId: string, page = 1, pageSize = 96): Promise<WorksResponse> {
    return this.getFilteredWorks(`${API_HOST}/playlist/get-playlist-works`, {
      id: playlistId,
      page: String(page),
      pageSize: String(pageSize),
    });
  }

  // ----- playlists -----

  async getPlaylists(page = 1, pageSize = 96, filterBy = 'all') {
    if (this.token === null) return { playlists: [], pagination: emptyPagination() };
    return playlistsResponseSchema.parse(
      await this.send('GET', `${API_HOST}/playlist/get-playlists`, undefined, {
        page: String(page),
        pageSize: String(pageSize),
        filterBy,
      }),
    );
  }

  async addWorksToPlaylist(playlistId: string, workIds: readonly string[]): Promise<void> {
    await this.send('POST', `${API_HOST}/playlist/add-works-to-playlist`, { id: playlistId, works: workIds });
  }

  async removeWorksFromPlaylist(playlistId: string, workIds: readonly string[]): Promise<void> {
    await this.send('POST', `${API_HOST}/playlist/remove-works-from-playlist`, { id: playlistId, works: workIds });
  }

  async createPlaylist(name: string, description = '', privacy = 0): Promise<AsmrPlaylist> {
    return asmrPlaylistSchema.parse(
      await this.send('POST', `${API_HOST}/playlist/create-playlist`, {
        name,
        privacy,
        locale: 'en',
        description,
        works: [],
      }),
    );
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    await this.send('POST', `${API_HOST}/playlist/delete-playlist`, { id: playlistId });
  }

  /** Nested `data` object. The Kotlin client could not send this (its serializer rejected maps). */
  async editPlaylist(playlistId: string, name: string, description = '', privacy = 0): Promise<void> {
    await this.send('POST', `${API_HOST}/playlist/edit-playlist-metadata`, {
      id: playlistId,
      data: { name, privacy, description },
    });
  }

  // ----- tags, likes, subtitles -----

  /** Tags sorted by English name. Cached per mirror (tags are not translated). */
  async getTags(): Promise<readonly Tag[]> {
    const key = this.mirror();
    if (this.tagsCache?.key === key) return this.tagsCache.tags;
    const parsed = z.array(tagSchema).parse(await this.send('GET', `${this.baseUrl()}/tags/`));
    const tags = sortByText(parsed, (t) => t.i18n['en-us'].name ?? t.name);
    this.tagsCache = { key, tags };
    return tags;
  }

  async getSubtitleFile(url: string): Promise<string> {
    const res = await httpCall(this.dispatcher, {
      url,
      method: 'GET',
      headers: this.headers(),
    });
    const text = await res.body.text();
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`Failed to send request: ${res.statusCode}: ${text}`);
    }
    return text;
  }

  async rateWork(workId: string, rating: number): Promise<void> {
    await this.send('PUT', `${API_HOST}/review`, { work_id: workId, rating });
  }

  async deleteRating(workId: string): Promise<void> {
    await this.send('DELETE', `${API_HOST}/review`, {}, { work_id: workId });
  }

  // ----- plumbing -----

  private async getFilteredWorks(url: string, query: Record<string, string>): Promise<WorksResponse> {
    const raw = worksResponseSchema.parse(await this.send('GET', url, undefined, query));
    return this.finishWorks(raw);
  }

  private async postWorks(url: string, body: Record<string, unknown>): Promise<WorksResponse> {
    const raw = worksResponseSchema.parse(await this.send('POST', url, body));
    return this.finishWorks(raw);
  }

  /** Subtitle filter first, then translation (same order as the Kotlin code). */
  private async finishWorks(response: WorksResponse): Promise<WorksResponse> {
    const filtered = this.onlySubtitled()
      ? { works: response.works.filter((w) => w.has_subtitle), pagination: response.pagination }
      : response;
    return translateWorks(filtered, this.language());
  }

  private headers(withJson = true): Record<string, string> {
    const headers: Record<string, string> = {
      Origin: 'https://asmr.one',
      Referer: 'https://asmr.one/',
      'Accept-Language': 'zh,zh;q=0.9',
    };
    if (withJson) headers['Content-Type'] = 'application/json';
    if (this.token !== null) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  /**
   * One API call. A network failure is retried once. An HTTP error status is final.
   * Returns the parsed JSON (or undefined for an empty body).
   */
  private async send(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<unknown> {
    const target = new URL(url);
    if (query) for (const [k, v] of Object.entries(query)) target.searchParams.set(k, v);
    const payload = method === 'GET' ? undefined : JSON.stringify(body ?? {});

    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      let res: Awaited<ReturnType<typeof httpCall>>;
      try {
        res = await httpCall(this.dispatcher, { url: target, method, headers: this.headers(), body: payload });
      } catch (err) {
        lastError = err;
        continue;
      }
      const text = await res.body.text();
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(`Failed to send request: ${res.statusCode}: ${text}`);
      }
      return text.length === 0 ? undefined : JSON.parse(text);
    }
    throw lastError;
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function emptyPagination(): Pagination {
  return { currentPage: 0, pageSize: 0, totalCount: 0 };
}

function emptyWorks(): WorksResponse {
  return { works: [], pagination: emptyPagination() };
}

/** Title-only translation for a single work (Kotlin Work.translate). Keeps the title on error. */
export async function translateWorkTitle(title: string, language: TranslationLanguage): Promise<string> {
  try {
    return moveFirstGroupToEnd(await translateText(title, language));
  } catch (err) {
    appLogger().warn({ err }, 'title translation failed');
    return title;
  }
}

/** Translates titles and circle names together (Kotlin WorksResponse.translate). */
export async function translateWorks(response: WorksResponse, language: TranslationLanguage): Promise<WorksResponse> {
  const titles = response.works.map((w) => w.title);
  const names = response.works.map((w) => w.name);
  const map = await translateList([...titles, ...names], language);
  if (!map) return response;
  const works = response.works.map((w) => ({
    ...w,
    title: map.has(w.title) ? moveFirstGroupToEnd(map.get(w.title) ?? w.title) : w.title,
    name: map.has(w.name) ? moveFirstGroupToEnd(map.get(w.name) ?? w.name) : w.name,
  }));
  return { works, pagination: response.pagination };
}

/** Translates audio and folder titles in place (Kotlin Folder.translate). */
export async function translateFolder(root: FolderNode, language: TranslationLanguage): Promise<void> {
  const map = await translateList(getAllTitles(root), language);
  if (map) applyTranslations(root, map);
}
