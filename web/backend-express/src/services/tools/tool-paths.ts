import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type Variant = 'metal' | 'cpu' | 'system';

/** Engine builds in the order they are preferred. */
const BUILT_VARIANTS = ['metal', 'cpu'] as const;

/** Variants present on disk, best first. Outside the desktop app: ['system']. */
export function availableVariants(binDir: string | null): Variant[] {
  if (binDir === null) return ['system'];
  return BUILT_VARIANTS.filter((variant) => existsSync(whisperPath(binDir, variant)));
}

/** The whisper-server binary for a variant. `system` (and no bundled folder) means the fallback. */
export function whisperBin(binDir: string | null, variant: Variant, fallback: string): string {
  if (binDir === null || variant === 'system') return fallback;
  return whisperPath(binDir, variant);
}

/** The bundled ffmpeg, or the fallback outside the desktop app. */
export function ffmpegBin(binDir: string | null, fallback: string): string {
  return binDir === null ? fallback : join(binDir, 'ffmpeg');
}

function whisperPath(binDir: string, variant: Exclude<Variant, 'system'>): string {
  return join(binDir, 'whisper', variant, 'whisper-server');
}
