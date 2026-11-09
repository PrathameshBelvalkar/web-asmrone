/** Key/value store the extension reads and writes (Echo `common` Settings). */
export interface Settings {
  getString(key: string): string | null;
  putString(key: string, value: string | null): void;
  getStringSet(key: string): ReadonlySet<string> | null;
  putStringSet(key: string, value: ReadonlySet<string> | null): void;
  getInt(key: string): number | null;
  putInt(key: string, value: number | null): void;
  getBoolean(key: string): boolean | null;
  putBoolean(key: string, value: boolean | null): void;
}

interface SettingBase {
  readonly title: string;
  readonly key: string;
  readonly summary?: string | null;
}

export type Setting =
  | (SettingBase & { readonly kind: 'Category'; readonly items: readonly Setting[] })
  | (SettingBase & { readonly kind: 'Item' })
  | (SettingBase & { readonly kind: 'Switch'; readonly defaultValue: boolean })
  | (SettingBase & {
      readonly kind: 'List';
      readonly entryTitles: readonly string[];
      readonly entryValues: readonly string[];
      readonly defaultEntryIndex: number | null;
    })
  | (SettingBase & {
      readonly kind: 'MultipleChoice';
      readonly entryTitles: readonly string[];
      readonly entryValues: readonly string[];
      readonly defaultEntryIndices: readonly number[] | null;
    })
  | (SettingBase & { readonly kind: 'TextInput'; readonly defaultValue: string | null })
  | (SettingBase & {
      readonly kind: 'Slider';
      readonly defaultValue: number | null;
      readonly from: number;
      readonly to: number;
      readonly steps: number | null;
    })
  | (SettingBase & { readonly kind: 'OnClick'; readonly onClick: () => Promise<void> });
