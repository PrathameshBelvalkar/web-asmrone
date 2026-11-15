import type { Request, Response } from 'express';
import type { StorageService } from '../services/storage.service.js';

/** Settings › Storage: usage, clear cache, clear all data. */
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  usage = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.storage.usage());
  };

  clearCache = async (_req: Request, res: Response): Promise<void> => {
    await this.storage.clearCache();
    res.status(204).end();
  };

  clearData = async (_req: Request, res: Response): Promise<void> => {
    await this.storage.clearData();
    res.status(204).end();
  };
}
