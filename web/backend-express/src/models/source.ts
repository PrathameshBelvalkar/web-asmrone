/** Music sources the app can browse. `asmrone` is the default. */
export const SOURCE_IDS = ['asmrone', 'jasmr'] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export function isSourceId(value: string): value is SourceId {
  return (SOURCE_IDS as readonly string[]).includes(value);
}
