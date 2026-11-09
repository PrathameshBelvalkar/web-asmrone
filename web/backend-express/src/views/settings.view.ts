import type { ResolvedSetting } from '../models/presentation.js';
import type { Json } from '../models/json.js';

/** SettingDto. The values are already resolved by the settings service. */
export function settingView(setting: ResolvedSetting): Json {
  return {
    kind: setting.kind,
    key: setting.key,
    title: setting.title,
    summary: setting.summary,
    options: setting.options ? setting.options.map((o) => ({ title: o.title, value: o.value })) : null,
    value: setting.value,
    min: setting.min,
    max: setting.max,
    steps: setting.steps,
    children: setting.children ? setting.children.map(settingView) : null,
  };
}
