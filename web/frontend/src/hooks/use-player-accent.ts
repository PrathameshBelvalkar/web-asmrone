import { useEffect } from 'react';
import { imageUrl } from '../lib/media';
import { useArtworkPalette } from '../lib/palette';
import { usePlayer } from '../player/store';

/**
 * Sets `--player-accent` on <html> to the playing track's most colourful hue, so the player bar's
 * progress and glow follow the artwork. Falls back to the brand colour (the stylesheet default).
 */
export function usePlayerAccent(): void {
  const cover = usePlayer((s) => (s.index >= 0 ? s.queue[s.index]?.cover : undefined));
  const palette = useArtworkPalette(imageUrl(cover));
  const accent = palette?.vibrant ?? null;
  useEffect(() => {
    const root = document.documentElement;
    if (accent) root.style.setProperty('--player-accent', accent);
    else root.style.removeProperty('--player-accent');
  }, [accent]);
}
