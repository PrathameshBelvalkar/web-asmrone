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
import { JasmrExtension } from './extension/jasmr/jasmr.extension.js';
import { SourceRouter } from './extension/source-router.js';
import { SettingsRepository } from './repositories/settings.repository.js';
import { UserRepository } from './repositories/user.repository.js';
import { AuthService } from './services/auth.service.js';
import { FeedService } from './services/feed.service.js';
import { MediaService } from './services/media.service.js';
import { PlaylistService } from './services/playlist.service.js';
import { PresentationService } from './services/presentation.service.js';
import { ProxyService } from './services/proxy.service.js';
import { SettingsService } from './services/settings.service.js';
import { AiSubtitleService } from './services/ai-subtitles/ai-subtitle.service.js';
import { WhisperServerEngine } from './services/ai-subtitles/whisper-server.js';
import { FfmpegAudioStream } from './services/ai-subtitles/audio-stream.js';
import { AiSubtitleRepository } from './repositories/ai-subtitle.repository.js';
import { languageForCode } from './extension/asmrone/languages.js';
import { translateList } from './extension/asmrone/translation/translate-list.js';
import { moveFirstGroupToEnd } from './extension/asmrone/translation/title.js';
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
  readonly jasmrDispatcher?: Dispatcher;
  /** AI subtitles for tracks without lyrics; null turns them off. Defaults to local Whisper. */
  readonly aiSubtitles?: AiSubtitleService | null;
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
    options.asmrDispatcher ?? createDispatcher({ connectMs: LIMITS.asmrConnectTimeoutMs, responseMs: LIMITS.asmrResponseTimeoutMs });
  const ownProxy = options.proxyDispatcher === undefined;
  const proxyDispatcher: Dispatcher =
    options.proxyDispatcher ??
    createDispatcher({ connectMs: LIMITS.proxyConnectTimeoutMs, responseMs: LIMITS.proxyReadTimeoutMs });

  const ownJasmr = options.jasmrDispatcher === undefined;
  const jasmrDispatcher: Dispatcher =
    options.jasmrDispatcher ??
    createDispatcher({ connectMs: LIMITS.jasmrConnectTimeoutMs, responseMs: LIMITS.jasmrResponseTimeoutMs });

  const asmrExtension: MusicExtension = options.extension ?? new AsmrOneExtension(asmrDispatcher);
  const jasmrExtension: MusicExtension = new JasmrExtension(jasmrDispatcher, {
    crawlDelayMs: config.jasmrCrawlDelayMs,
    cacheTtlMs: LIMITS.jasmrCacheTtlMs,
  });
  const extension = new SourceRouter(asmrExtension, jasmrExtension);

  const presentation = new PresentationService(feeds, issued);
  const feedService = new FeedService(extension, feeds, pages);
  const aiSubtitles =
    options.aiSubtitles === undefined
      ? new AiSubtitleService({
          extension,
          engine: new WhisperServerEngine(config.whisper),
          openAudio: (input) => FfmpegAudioStream.open(config.whisper.ffmpegBin, input),
          repository: new AiSubtitleRepository(join(config.dataDir, 'ai-subtitles')),
          translator: {
            languageCode: () => languageForCode(settingsRepo.getString('translationLanguage')).code,
            translate: async (texts) => {
              const map = await translateList(texts, languageForCode(settingsRepo.getString('translationLanguage')));
              return map ? texts.map((t) => moveFirstGroupToEnd(map.get(t) ?? t)) : null;
            },
          },
          enabled: () => settingsRepo.getBoolean('aiSubtitles') ?? true,
        })
      : options.aiSubtitles;
  const mediaService = new MediaService(extension, feedService, aiSubtitles);
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
        ownJasmr ? jasmrDispatcher.close() : undefined,
        aiSubtitles?.close(),
      ]);
    },
  };
}
