import type { Request, Response } from 'express';
import { HttpError } from '../models/errors.js';
import type { FeedService } from '../services/feed.service.js';
import type { PresentationService } from '../services/presentation.service.js';
import { feedView } from '../views/feed.view.js';
import { pageView } from '../views/page.view.js';
import { quickSearchView } from '../views/quick-search.view.js';
import { paramString, queryString, sourceParam } from './query.js';

/** Home, library, search, quick search and paging. */
export class FeedController {
  constructor(
    private readonly feeds: FeedService,
    private readonly presentation: PresentationService,
  ) {}

  home = async (req: Request, res: Response): Promise<void> => {
    res.json(feedView(await this.feeds.home(sourceParam(req)), this.presentation.context()));
  };

  library = async (_req: Request, res: Response): Promise<void> => {
    res.json(feedView(await this.feeds.library(), this.presentation.context()));
  };

  search = async (req: Request, res: Response): Promise<void> => {
    const q = queryString(req, 'q') ?? '';
    res.json(feedView(await this.feeds.search(q, sourceParam(req)), this.presentation.context()));
  };

  quickSearch = async (req: Request, res: Response): Promise<void> => {
    const q = queryString(req, 'q') ?? '';
    if (q.trim().length === 0) {
      res.json([]);
      return;
    }
    res.json(quickSearchView(await this.feeds.quickSearch(q, sourceParam(req))));
  };

  openFeed = async (req: Request, res: Response): Promise<void> => {
    const opened = await this.feeds.openExisting(paramString(req, 'id'), queryString(req, 'tab') ?? null);
    if (opened === null) throw HttpError.expired();
    res.json(feedView(opened, this.presentation.context()));
  };

  page = async (req: Request, res: Response): Promise<void> => {
    const page = await this.feeds.loadPage(paramString(req, 'id'), queryString(req, 'cont') ?? null);
    if (page === null) throw HttpError.expired();
    res.json(pageView(page.data, page.continuation, this.presentation.context()));
  };
}
