import { useEffect, useState } from 'react';
import { proxyUrl } from '../api/client';

export const DEFAULT_PALETTE: [string, string] = ['#3b3f4a', '#1c1e24'];

/**
 * Colours taken from a cover.
 * - `top` / `bottom`: averages of the top and bottom halves, slightly darkened (backdrops).
 * - `vibrant`: the cover's most colourful hue, tuned to read well on a dark background (accents).
 *   Null for greyscale covers; callers fall back to the brand colour.
 */
export interface Palette {
  top: string;
  bottom: string;
  vibrant: string | null;
}

const SIZE = 24;
const cache = new Map<string, Palette>();
const pending = new Map<string, Promise<Palette | null>>();

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

/** Average the pixels in rows [from, to), darkened a little so white text stays readable. */
function averageRows(data: Uint8ClampedArray, from: number, to: number): string {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = from; y < to; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  }
  const k = 0.9;
  return `rgb(${Math.round((r / n) * k)}, ${Math.round((g / n) * k)}, ${Math.round((b / n) * k)})`;
}

/**
 * The most colourful hue: pixels are bucketed by hue (12 buckets), each weighted by saturation and
 * by how close it is to mid lightness. The winning bucket's mean hue is returned at a fixed,
 * accent-friendly saturation and lightness.
 */
function vibrantHue(data: Uint8ClampedArray): string | null {
  const buckets = Array.from({ length: 12 }, () => ({ weight: 0, x: 0, y: 0, s: 0 }));
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.18 || l < 0.12 || l > 0.92) continue;
    const w = s * (1 - Math.abs(l - 0.5) * 1.6);
    if (w <= 0) continue;
    const bucket = buckets[Math.floor(h / 30) % 12];
    const rad = (h * Math.PI) / 180;
    bucket.weight += w;
    bucket.x += Math.cos(rad) * w;
    bucket.y += Math.sin(rad) * w;
    bucket.s += s * w;
    total += w;
  }
  const best = buckets.reduce((a, b) => (b.weight > a.weight ? b : a));
  // Too little colour in the cover: treat it as greyscale.
  if (total === 0 || best.weight < (SIZE * SIZE) * 0.02) return null;
  const hue = ((Math.atan2(best.y, best.x) * 180) / Math.PI + 360) % 360;
  const sat = Math.min(85, Math.max(55, (best.s / best.weight) * 100));
  return `hsl(${Math.round(hue)} ${Math.round(sat)}% 62%)`;
}

function extract(src: string): Promise<Palette | null> {
  const cached = cache.get(src);
  if (cached) return Promise.resolve(cached);
  const inFlight = pending.get(src);
  if (inFlight) return inFlight;
  const promise = new Promise<Palette | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
        const palette: Palette = {
          top: averageRows(data, 0, SIZE / 2),
          bottom: averageRows(data, SIZE / 2, SIZE),
          vibrant: vibrantHue(data),
        };
        cache.set(src, palette);
        resolve(palette);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    // Read through the server proxy so the canvas isn't tainted by a cross-origin read.
    img.src = proxyUrl(src);
  }).finally(() => pending.delete(src));
  pending.set(src, promise);
  return promise;
}

/** The palette of a cover, or null while it loads (or when it can't be read). Results are cached. */
export function useArtworkPalette(src: string | undefined): Palette | null {
  const [palette, setPalette] = useState<Palette | null>(() => (src ? cache.get(src) ?? null : null));

  useEffect(() => {
    if (!src) {
      setPalette(null);
      return;
    }
    const cached = cache.get(src);
    if (cached) {
      setPalette(cached);
      return;
    }
    setPalette(null);
    let cancelled = false;
    void extract(src).then((p) => {
      if (!cancelled) setPalette(p);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return palette;
}

/** Two backdrop colours from a cover: the average of its top and bottom halves. */
export function usePalette(src: string | undefined): [string, string] {
  const palette = useArtworkPalette(src);
  return palette ? [palette.top, palette.bottom] : DEFAULT_PALETTE;
}
