import type { Feed } from '../models/feed.js';
import type { ViewContext } from '../models/presentation.js';
import type { ExpiringRegistry } from '../stores/expiring-registry.js';
import type { IssuedUrls } from '../stores/issued-urls.js';

/** Builds the ViewContext that views use to register feeds and proxy URLs. */
export class PresentationService {
  constructor(
    private readonly feeds: ExpiringRegistry<Feed<unknown>>,
    private readonly issued: IssuedUrls,
  ) {}

  context(): ViewContext {
    return {
      registerFeed: (feed: Feed<unknown>) => {
        return this.feeds.put(feed);
      },
      issueUrl: (url: string) => {
        this.issued.add(url);
      },
    };
  }
}
