import type { Request, Response } from 'express';
import { mediaView } from '../views/media.view.js';
import { feedView } from '../views/feed.view.js';
import { lyricsView } from '../views/page.view.js';
import { radioResponseView } from '../views/responses.view.js';
import { streamView } from '../views/stream.view.js';
import { optionalBoolean, type JsonObject } from '../schemas/body.js';
import { parseMediaItem } from '../schemas/media-item.schema.js';
import type { MediaService } from '../services/media.service.js';
import type { PresentationService } from '../services/presentation.service.js';
import { typedItem } from './body.js';

/** Albums, artists, playlists (read side), tracks, lyrics, radio, sharing and likes. */
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly presentation: PresentationService,
  ) {}

  private body(req: Request): JsonObject {
    return req.jsonBody;
  }

  albumLoad = async (req: Request, res: Response): Promise<void> => {
    const ctx = this.presentation.context();
    res.json(mediaView(await this.media.loadAlbum(typedItem(this.body(req), 'Album')), ctx.issueUrl));
  };

  albumFeed = async (req: Request, res: Response): Promise<void> => {
    const opened = await this.media.albumFeed(typedItem(this.body(req), 'Album'));
    res.json(feedView(opened, this.presentation.context()));
  };

  albumTracks = async (req: Request, res: Response): Promise<void> => {
    const opened = await this.media.albumTracks(typedItem(this.body(req), 'Album'));
    res.json(feedView(opened, this.presentation.context()));
  };

  artistLoad = async (req: Request, res: Response): Promise<void> => {
    const ctx = this.presentation.context();
    res.json(mediaView(await this.media.loadArtist(typedItem(this.body(req), 'Artist')), ctx.issueUrl));
  };

  artistFeed = async (req: Request, res: Response): Promise<void> => {
    const opened = await this.media.artistFeed(typedItem(this.body(req), 'Artist'));
    res.json(feedView(opened, this.presentation.context()));
  };

  playlistLoad = async (req: Request, res: Response): Promise<void> => {
    const ctx = this.presentation.context();
    res.json(mediaView(await this.media.loadPlaylist(typedItem(this.body(req), 'Playlist')), ctx.issueUrl));
  };

  playlistFeed = async (req: Request, res: Response): Promise<void> => {
    const opened = await this.media.playlistFeed(typedItem(this.body(req), 'Playlist'));
    res.json(feedView(opened, this.presentation.context()));
  };

  playlistTracks = async (req: Request, res: Response): Promise<void> => {
    const opened = await this.media.playlistTracks(typedItem(this.body(req), 'Playlist'));
    res.json(feedView(opened, this.presentation.context()));
  };

  trackLoad = async (req: Request, res: Response): Promise<void> => {
    const ctx = this.presentation.context();
    res.json(mediaView(await this.media.loadTrack(typedItem(this.body(req), 'Track')), ctx.issueUrl));
  };

  trackMedia = async (req: Request, res: Response): Promise<void> => {
    const ctx = this.presentation.context();
    const track = typedItem(this.body(req), 'Track');
    res.json(streamView(await this.media.trackMedia(track), ctx.issueUrl));
  };

  lyrics = async (req: Request, res: Response): Promise<void> => {
    const lyrics = await this.media.lyrics(typedItem(this.body(req), 'Track'));
    res.json(lyrics === null ? null : lyricsView(lyrics));
  };

  radio = async (req: Request, res: Response): Promise<void> => {
    const body = this.body(req);
    const item = parseMediaItem(body.item ?? null);
    const context = body.context === undefined || body.context === null ? null : parseMediaItem(body.context);
    const { radio, feed } = await this.media.radio(item, context);
    res.json(radioResponseView(radio, feed, this.presentation.context()));
  };

  share = async (req: Request, res: Response): Promise<void> => {
    const url = await this.media.share(parseMediaItem(this.body(req).item ?? null));
    res.json({ url });
  };

  like = async (req: Request, res: Response): Promise<void> => {
    const body = this.body(req);
    const item = parseMediaItem(body.item ?? null);
    await this.media.like(item, optionalBoolean(body, 'shouldLike') ?? true);
    res.status(204).end();
  };

  likeStatus = async (req: Request, res: Response): Promise<void> => {
    const liked = await this.media.likeStatus(parseMediaItem(this.body(req).item ?? null));
    res.json({ liked });
  };
}
