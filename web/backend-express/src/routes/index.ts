import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';
import type { FeedController } from '../controllers/feed.controller.js';
import type { MediaController } from '../controllers/media.controller.js';
import type { PlaylistController } from '../controllers/playlist.controller.js';
import type { ProxyController } from '../controllers/proxy.controller.js';
import type { SettingsController } from '../controllers/settings.controller.js';
import { jsonObjectBody } from '../middlewares/json-body.js';
import { notFound } from '../middlewares/not-found.js';

export interface Controllers {
  readonly feed: FeedController;
  readonly media: MediaController;
  readonly playlist: PlaylistController;
  readonly auth: AuthController;
  readonly settings: SettingsController;
  readonly proxy: ProxyController;
}

/** Every /api route. Paths and methods match the Kotlin server. */
export function createApiRouter(c: Controllers): Router {
  const router = Router();
  router.use(jsonObjectBody());

  // feeds
  router.get('/home', c.feed.home);
  router.get('/library', c.feed.library);
  router.get('/search', c.feed.search);
  router.get('/quicksearch', c.feed.quickSearch);
  router.get('/feeds/:id/open', c.feed.openFeed);
  router.get('/pages/:id', c.feed.page);

  // albums, artists, playlists, tracks
  router.post('/album/load', c.media.albumLoad);
  router.post('/album/feed', c.media.albumFeed);
  router.post('/album/tracks', c.media.albumTracks);
  router.post('/artist/load', c.media.artistLoad);
  router.post('/artist/feed', c.media.artistFeed);
  router.post('/playlist/load', c.media.playlistLoad);
  router.post('/playlist/feed', c.media.playlistFeed);
  router.post('/playlist/tracks', c.media.playlistTracks);
  router.post('/track/load', c.media.trackLoad);
  router.post('/track/media', c.media.trackMedia);
  router.post('/lyrics', c.media.lyrics);
  router.post('/radio', c.media.radio);
  router.post('/share', c.media.share);
  router.post('/like', c.media.like);
  router.post('/like/status', c.media.likeStatus);

  // playlist editing
  router.post('/playlists/editable', c.playlist.editable);
  router.post('/playlists/create', c.playlist.create);
  router.post('/playlists/delete', c.playlist.delete);
  router.post('/playlists/edit', c.playlist.edit);
  router.post('/playlists/privacy', c.playlist.privacy);
  router.post('/playlists/add-tracks', c.playlist.addTracks);
  router.post('/playlists/remove-tracks', c.playlist.removeTracks);

  // account
  router.get('/auth/forms', c.auth.forms);
  router.post('/auth/login', c.auth.login);
  router.post('/auth/logout', c.auth.logout);
  router.get('/auth/me', c.auth.me);

  // settings and proxy
  router.get('/settings', c.settings.list);
  router.put('/settings/:key', c.settings.update);
  router.get('/proxy', c.proxy.stream);

  router.use(notFound);
  return router;
}
