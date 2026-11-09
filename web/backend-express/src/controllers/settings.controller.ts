import type { Request, Response } from 'express';
import type { Json } from '../models/json.js';
import { settingView } from '../views/settings.view.js';
import type { SettingsService } from '../services/settings.service.js';
import { paramString } from './query.js';

/** Settings page: list the settings, and save one value. */
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    const items = await this.settings.list();
    res.json(items.map(settingView));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const key = paramString(req, 'key');
    const value = req.jsonBody.value;
    // An absent or JSON null value removes the stored setting.
    await this.settings.update(key, value === undefined || value === null ? undefined : (value as Json));
    res.status(204).end();
  };
}
