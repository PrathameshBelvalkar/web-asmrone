import { join } from 'node:path';
import type { Dispatcher } from 'undici';
import type { Logger } from 'pino';
import type { AppConfig } from './config/env.js';
import { LIMITS } from './config/limits.js';
import { AuthController } from './controllers/auth.controller.js';
import { FeedController } from './controllers/feed.controller.js';
import { MediaController } from './controllers/media.controller.js';
import { PlaylistController } from './controllers/playlist.controller.js';
import { ProxyController } from './controllers/proxy.controller.js';
import { SettingsController } from './controllers/settings.controller.js';
import { createDispatcher } from './lib/http-client.js';
import type { Feed } from './models/feed.js';
import type { PagedData } from './models/paged-data.js';
import type { MusicExtension } from './models/extension.js';
import { AsmrOneExtension } from './extension/asmrone/asmr-one.extension.js';
import { SettingsRepository } from './repositories/settings.repository.js';
import { UserRepository } from './repositories/user.repository.js';
import { AuthService } from './services/auth.service.js';
import { FeedService } from './services/feed.service.js';
import { MediaService } from './services/media.service.js';
import { PlaylistService } from './services/playlist.service.js';
import { PresentationService } from './services/presentation.service.js';
import { ProxyService } from './services/proxy.service.js';
import { SettingsService } from './services/settings.service.js';
import { ExpiringRegistry } from './stores/expiring-registry.js';
import { IssuedUrls } from './stores/issued-urls.js';
import type { Controllers } from './routes/index.js';
import { systemClock } from './lib/clock.js';
import { useAppLogger } from './lib/app-logger.js';

/** Composition root. Builds every object once and wires them together; nothing else news them up. */
export interface Container {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly controllers: Controllers;
  readonly onSessionExpired: () => Promise<void>;
  /** Loads settings into the extension and restores the saved login. Call once before serving. */
  init(): Promise<void>;
  close(): Promise<void>;
}

/** Optional overrides, used by tests to replace the network-facing pieces. */
export interface ContainerOptions {
  readonly extension?: MusicExtension;
  readonly asmrDispatcher?: Dispatcher;
  readonly proxyDispatcher?: Dispatcher;
}

export function createContainer(config: AppConfig, logger: Logger, options: ContainerOptions = {}): Container {
  useAppLogger(logger);
  const settingsRepo = new SettingsRepository(join(config.dataDir, 'settings.json'));
  const userRepo = new UserRepository(join(config.dataDir, 'user.json'));

  const feeds = new ExpiringRegistry<Feed<unknown>>(LIMITS.registryMaxSize, LIMITS.registryTtlMs, systemClock);
  const pages = new ExpiringRegistry<PagedData<unknown>>(LIMITS.registryMaxSize, LIMITS.registryTtlMs, systemClock);
  const issued = new IssuedUrls(LIMITS.issuedUrlsMax);

  const ownAsmr = options.asmrDispatcher === undefined;
  const asmrDispatcher: Dispatcher =
    options.asmrDispatcher ?? createDispatcher({ connectMs: 10_000, responseMs: 10_000 });
  const ownProxy = options.proxyDispatcher === undefined;
  const proxyDispatcher: Dispatcher =
    options.proxyDispatcher ??
    createDispatcher({ connectMs: LIMITS.proxyConnectTimeoutMs, responseMs: LIMITS.proxyReadTimeoutMs });

  const extension: MusicExtension = options.extension ?? new AsmrOneExtension(asmrDispatcher);

  const presentation = new PresentationService(feeds, issued);
  const feedService = new FeedService(extension, feeds, pages);
  const mediaService = new MediaService(extension, feedService);
  const playlistService = new PlaylistService(extension);
  const authService = new AuthService(extension, userRepo);
  const settingsService = new SettingsService(extension, settingsRepo);
  const proxyService = new ProxyService(issued, proxyDispatcher);

  const controllers: Controllers = {
    feed: new FeedController(feedService, presentation),
    media: new MediaController(mediaService, presentation),
    playlist: new PlaylistController(playlistService, presentation),
    auth: new AuthController(authService),
    settings: new SettingsController(settingsService),
    proxy: new ProxyController(proxyService),
  };

  return {
    config,
    logger,
    controllers,
    onSessionExpired: () => authService.expireSession(),
    async init() {
      extension.setSettings(settingsRepo);
      await extension.onInitialize();
      await extension.onExtensionSelected();
      await authService.restore();
    },
    async close() {
      await Promise.all([
        ownAsmr ? asmrDispatcher.close() : undefined,
        ownProxy ? proxyDispatcher.close() : undefined,
      ]);
    },
  };
}
