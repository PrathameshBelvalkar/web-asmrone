import type { Request, Response } from 'express';
import { HttpError } from '../models/errors.js';
import type { ToolsService } from '../services/tools/tools.service.js';
import { paramString } from './query.js';

/** AI subtitle setup: status, the automatic setup, pause, and the model choice. */
export class ToolsController {
  constructor(private readonly tools: ToolsService) {}

  status = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.tools.status());
  };

  /** Starts the setup, or resumes a paused download. */
  setup = async (_req: Request, res: Response): Promise<void> => {
    await this.tools.resume();
    res.status(202).end();
  };

  downloadModel = async (req: Request, res: Response): Promise<void> => {
    await this.tools.downloadModel(paramString(req, 'id'));
    res.status(202).end();
  };

  pauseDownload = async (_req: Request, res: Response): Promise<void> => {
    await this.tools.pauseDownload();
    res.status(204).end();
  };

  /** Cancel: stops the download and deletes its partial file. */
  cancelDownload = async (_req: Request, res: Response): Promise<void> => {
    await this.tools.cancelDownload();
    res.status(204).end();
  };

  selectModel = async (req: Request, res: Response): Promise<void> => {
    const id = req.jsonBody.id;
    if (typeof id !== 'string') throw HttpError.badRequest('id must be a model id.');
    await this.tools.selectModel(id);
    res.status(204).end();
  };

  benchmark = async (_req: Request, res: Response): Promise<void> => {
    await this.tools.startBenchmark();
    res.status(202).end();
  };

  deleteModel = async (req: Request, res: Response): Promise<void> => {
    await this.tools.deleteModel(paramString(req, 'id'));
    res.status(204).end();
  };
}
