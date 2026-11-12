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

  setup = (_req: Request, res: Response): void => {
    this.tools.startSetup();
    res.status(202).end();
  };

  downloadModel = async (req: Request, res: Response): Promise<void> => {
    await this.tools.downloadModel(paramString(req, 'id'));
    res.status(202).end();
  };

  cancelDownload = (_req: Request, res: Response): void => {
    this.tools.stopSetup();
    res.status(204).end();
  };

  selectModel = async (req: Request, res: Response): Promise<void> => {
    const id = req.jsonBody.id;
    if (typeof id !== 'string') throw HttpError.badRequest('id must be a model id.');
    await this.tools.selectModel(id);
    res.status(204).end();
  };

  deleteModel = async (req: Request, res: Response): Promise<void> => {
    await this.tools.deleteModel(paramString(req, 'id'));
    res.status(204).end();
  };
}
