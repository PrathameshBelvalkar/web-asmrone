import { useEffect, useState } from 'react';
import { proxyUrl } from '../api/client';

export const DEFAULT_PALETTE: [string, string] = ['#3b3f4a', '#1c1e24'];

/**
 * Two colours from a cover: the average of its top and bottom halves.
 * The image is read through the server proxy so the canvas isn't tainted by a cross-origin read.
 */
export function usePalette(src: string | undefined): [string, string] {
  const [colors, setColors] = useState<[string, string]>(DEFAULT_PALETTE);

  useEffect(() => {
    setColors(DEFAULT_PALETTE);
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        const average = (fromRow: number, toRow: number) => {
          let r = 0, g = 0, b = 0, n = 0;
          for (let y = fromRow; y < toRow; y++) {
            for (let x = 0; x < size; x++) {
              const i = (y * size + x) * 4;
              r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
            }
          }
          // Darken a little so white text stays readable.
          const k = 0.9;
          return `rgb(${Math.round((r / n) * k)}, ${Math.round((g / n) * k)}, ${Math.round((b / n) * k)})`;
        };
        setColors([average(0, size / 2), average(size / 2, size)]);
      } catch {
        setColors(DEFAULT_PALETTE);
      }
    };
    img.onerror = () => {
      if (!cancelled) setColors(DEFAULT_PALETTE);
    };
    img.src = proxyUrl(src);
    return () => {
      cancelled = true;
    };
  }, [src]);

  return colors;
}
