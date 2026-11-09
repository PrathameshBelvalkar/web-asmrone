import type { MusicExtension } from '../models/extension.js';
import type { Json } from '../models/json.js';
import type { Setting } from '../models/echo/settings.js';
import type { ResolvedSetting } from '../models/presentation.js';
import type { SettingsRepository } from '../repositories/settings.repository.js';

/** Settings page: resolves each setting's value (stored, else default) and saves changes. */
export class SettingsService {
  constructor(
    private readonly ext: MusicExtension,
    private readonly repo: SettingsRepository,
  ) {}

  async list(): Promise<ResolvedSetting[]> {
    return (await this.ext.getSettingItems()).map((s) => this.resolve(s));
  }

  /** Saves the value (undefined or null removes it), then tells the extension. */
  async update(key: string, value: Json | undefined): Promise<void> {
    await this.repo.setRaw(key, value);
    this.ext.setSettings(this.repo);
  }

  private resolve(setting: Setting): ResolvedSetting {
    const base = {
      key: setting.key,
      title: setting.title,
      summary: setting.summary ?? null,
      options: null,
      min: null,
      max: null,
      steps: null,
      children: null,
    } as const;
    const stored = this.repo.raw(setting.key);
    switch (setting.kind) {
      case 'Category':
        return { ...base, kind: 'category', value: null, children: setting.items.map((s) => this.resolve(s)) };
      case 'Item':
        return { ...base, kind: 'info', value: null };
      case 'OnClick':
        return { ...base, kind: 'button', value: null };
      case 'Switch':
        return { ...base, kind: 'switch', value: stored ?? setting.defaultValue };
      case 'List': {
        const fallback = setting.defaultEntryIndex === null ? null : (setting.entryValues[setting.defaultEntryIndex] ?? null);
        return {
          ...base,
          kind: 'list',
          options: zip(setting.entryTitles, setting.entryValues),
          value: stored ?? fallback,
        };
      }
      case 'MultipleChoice': {
        const defaults = (setting.defaultEntryIndices ?? [])
          .map((i) => setting.entryValues[i])
          .filter((v): v is string => v !== undefined);
        return {
          ...base,
          kind: 'multi',
          options: zip(setting.entryTitles, setting.entryValues),
          value: stored ?? defaults,
        };
      }
      case 'Slider':
        return {
          ...base,
          kind: 'slider',
          value: stored ?? setting.defaultValue ?? setting.from,
          min: setting.from,
          max: setting.to,
          steps: setting.steps,
        };
      case 'TextInput':
        return { ...base, kind: 'text', value: stored ?? setting.defaultValue ?? '' };
    }
  }
}

function zip(titles: readonly string[], values: readonly string[]): { title: string; value: string }[] {
  return titles.map((title, i) => ({ title, value: values[i] ?? '' }));
}
