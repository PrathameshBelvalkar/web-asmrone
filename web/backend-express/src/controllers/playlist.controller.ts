import type { Request, Response } from 'express';
import { mediaView } from '../views/media.view.js';
import { editableView } from '../views/responses.view.js';
import { optionalBoolean, optionalInt, optionalString, intArray, requiredString } from '../schemas/body.js';
import type { PlaylistService } from '../services/playlist.service.js';
import type { PresentationService } from '../services/presentation.service.js';
import { optionalItem, trackList, typedItem } from './body.js';

/** Playlist editing: editable lists, create, delete, metadata, privacy, and track membership. */
export class PlaylistController {
  constructor(
    private readonly playlists: PlaylistService,
    private readonly presentation: PresentationService,
  ) {}

  editable = async (req: Request, res: Response): Promise<void> => {
    const track = optionalItem(req.jsonBody, 'track');
    const list = await this.playlists.editable(track?.kind === 'Track' ? track : null);
    const ctx = this.presentation.context();
    res.json(list.map(([playlist, contains]) => editableView(playlist, contains, ctx)));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const body = req.jsonBody;
    const playlist = await this.playlists.create(requiredString(body, 'title'), optionalString(body, 'description') ?? null);
    res.json(mediaView(playlist, this.presentation.context().issueUrl));
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.playlists.delete(typedItem(req.jsonBody, 'Playlist'));
    res.status(204).end();
  };

  edit = async (req: Request, res: Response): Promise<void> => {
    const body = req.jsonBody;
    const playlist = typedItem(body, 'Playlist');
    await this.playlists.edit(playlist, requiredString(body, 'title'), optionalString(body, 'description') ?? null);
    res.status(204).end();
  };

  privacy = async (req: Request, res: Response): Promise<void> => {
    const body = req.jsonBody;
    const playlist = typedItem(body, 'Playlist');
    await this.playlists.privacy(playlist, optionalBoolean(body, 'isPrivate') ?? true);
    res.status(204).end();
  };

  addTracks = async (req: Request, res: Response): Promise<void> => {
    const body = req.jsonBody;
    const playlist = typedItem(body, 'Playlist');
    const existing = trackList(body, 'tracks');
    const added = trackList(body, 'new');
    await this.playlists.addTracks(playlist, existing, optionalInt(body, 'index') ?? existing.length, added);
    res.status(204).end();
  };

  removeTracks = async (req: Request, res: Response): Promise<void> => {
    const body = req.jsonBody;
    const playlist = typedItem(body, 'Playlist');
    const tracks = trackList(body, 'tracks');
    await this.playlists.removeTracks(playlist, tracks, intArray(body, 'indexes'));
    res.status(204).end();
  };
}
