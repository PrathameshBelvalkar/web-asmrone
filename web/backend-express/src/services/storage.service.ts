import type { AiSubtitleRepository } from '../repositories/ai-subtitle.repository.js';
import type { SettingsRepository } from '../repositories/settings.repository.js';
import type { AuthService } from './auth.service.js';
import type { ToolsService } from './tools/tools.service.js';

/** Answer of `GET /api/storage`. */
export interface StorageUsage {
  /** Saved AI subtitles. */
  readonly subtitlesBytes: number;
  /** Partial model downloads that nothing will resume. */
  readonly partialBytes: number;
}

/** Settings kept by "clear all data": the AI subtitles switch goes with the downloaded models. */
const KEPT_SETTINGS = ['aiSubtitles'] as const;

export interface StorageServiceDeps {
  readonly subtitles: Pick<AiSubtitleRepository, 'size' | 'clear'>;
  readonly settings: Pick<SettingsRepository, 'clear'>;
  readonly auth: Pick<AuthService, 'logout'>;
  readonly tools: Pick<ToolsService, 'leftoverPartialBytes' | 'removeLeftoverPartials'>;
  /** Pushes the (now empty) settings into the music extensions. */
  readonly applySettings: () => void;
}

/** The Storage card in Settings: what is cached, clearing the cache, and resetting the app. */
export class StorageService {
  constructor(private readonly deps: StorageServiceDeps) {}

  async usage(): Promise<StorageUsage> {
    const [subtitlesBytes, partialBytes] = await Promise.all([
      this.deps.subtitles.size(),
      this.deps.tools.leftoverPartialBytes(),
    ]);
    return { subtitlesBytes, partialBytes };
  }

  /** Deletes saved AI subtitles and leftover partial downloads. Downloaded models stay. */
  async clearCache(): Promise<void> {
    await this.deps.subtitles.clear();
    await this.deps.tools.removeLeftoverPartials();
  }

  /** Clears the cache, resets every preference and logs out. Downloaded models stay. */
  async clearData(): Promise<void> {
    await this.clearCache();
    await this.deps.settings.clear(KEPT_SETTINGS);
    this.deps.applySettings();
    await this.deps.auth.logout();
  }
}
