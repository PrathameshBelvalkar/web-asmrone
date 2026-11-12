import { Router, type RequestHandler } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';
import type { FeedController } from '../controllers/feed.controller.js';
import type { MediaController } from '../controllers/media.controller.js';
import type { PlaylistController } from '../controllers/playlist.controller.js';
import type { ProxyController } from '../controllers/proxy.controller.js';
import type { SettingsController } from '../controllers/settings.controller.js';
import type { ToolsController } from '../controllers/tools.controller.js';
import { jsonObjectBody } from '../middlewares/json-body.js';
import { methodNotAllowed, type RouteMeta } from '../middlewares/method-not-allowed.js';
import { notFound } from '../middlewares/not-found.js';

export interface Controllers {
  readonly feed: FeedController;
  readonly media: MediaController;
  readonly playlist: PlaylistController;
  readonly auth: AuthController;
  readonly settings: SettingsController;
  readonly proxy: ProxyController;
  readonly tools: ToolsController;
}

interface RouteSpec extends RouteMeta {
  readonly handler: RequestHandler;
}

/** Every /api route. Paths and methods match the Kotlin server. */
function routeTable(c: Controllers): RouteSpec[] {
  return [
    // feeds
    { method: 'GET', path: '/home', handler: c.feed.home },
    { method: 'GET', path: '/library', handler: c.feed.library },
    { method: 'GET', path: '/search', handler: c.feed.search },
    { method: 'GET', path: '/quicksearch', handler: c.feed.quickSearch },
    { method: 'GET', path: '/feeds/:id/open', handler: c.feed.openFeed },
    { method: 'GET', path: '/pages/:id', handler: c.feed.page },

    // albums, artists, playlists, tracks
    { method: 'POST', path: '/album/load', handler: c.media.albumLoad },
    { method: 'POST', path: '/album/feed', handler: c.media.albumFeed },
    { method: 'POST', path: '/album/tracks', handler: c.media.albumTracks },
    { method: 'POST', path: '/artist/load', handler: c.media.artistLoad },
    { method: 'POST', path: '/artist/feed', handler: c.media.artistFeed },
    { method: 'POST', path: '/playlist/load', handler: c.media.playlistLoad },
    { method: 'POST', path: '/playlist/feed', handler: c.media.playlistFeed },
    { method: 'POST', path: '/playlist/tracks', handler: c.media.playlistTracks },
    { method: 'POST', path: '/track/load', handler: c.media.trackLoad },
    { method: 'POST', path: '/track/media', handler: c.media.trackMedia },
    { method: 'POST', path: '/lyrics', handler: c.media.lyrics },
    { method: 'POST', path: '/radio', handler: c.media.radio },
    { method: 'POST', path: '/share', handler: c.media.share },
    { method: 'POST', path: '/like', handler: c.media.like },
    { method: 'POST', path: '/like/status', handler: c.media.likeStatus },

    // playlist editing
    { method: 'POST', path: '/playlists/editable', handler: c.playlist.editable },
    { method: 'POST', path: '/playlists/create', handler: c.playlist.create },
    { method: 'POST', path: '/playlists/delete', handler: c.playlist.delete },
    { method: 'POST', path: '/playlists/edit', handler: c.playlist.edit },
    { method: 'POST', path: '/playlists/privacy', handler: c.playlist.privacy },
    { method: 'POST', path: '/playlists/add-tracks', handler: c.playlist.addTracks },
    { method: 'POST', path: '/playlists/remove-tracks', handler: c.playlist.removeTracks },

    // account
    { method: 'GET', path: '/auth/forms', handler: c.auth.forms },
    { method: 'POST', path: '/auth/login', handler: c.auth.login },
    { method: 'POST', path: '/auth/logout', handler: c.auth.logout },
    { method: 'GET', path: '/auth/me', handler: c.auth.me },

    // settings and proxy
    { method: 'GET', path: '/settings', handler: c.settings.list },
    { method: 'PUT', path: '/settings/:key', handler: c.settings.update },
    { method: 'GET', path: '/proxy', handler: c.proxy.stream },

    // AI subtitle setup
    { method: 'GET', path: '/tools', handler: c.tools.status },
    { method: 'POST', path: '/tools/setup', handler: c.tools.setup },
    { method: 'POST', path: '/tools/models/:id/download', handler: c.tools.downloadModel },
    { method: 'POST', path: '/tools/download/cancel', handler: c.tools.cancelDownload },
    { method: 'PUT', path: '/tools/model', handler: c.tools.selectModel },
    { method: 'POST', path: '/tools/models/:id/delete', handler: c.tools.deleteModel },
  ];
}

export function createApiRouter(c: Controllers): Router {
  const router = Router();
  router.use(jsonObjectBody());

  const table = routeTable(c);
  for (const route of table) {
    if (route.method === 'GET') router.get(route.path, route.handler);
    else if (route.method === 'POST') router.post(route.path, route.handler);
    else router.put(route.path, route.handler);
  }

  router.use(methodNotAllowed(table));
  router.use(notFound);
  return router;
}
