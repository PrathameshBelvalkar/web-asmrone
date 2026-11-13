import { useRef } from 'react';
import { proxyUrl } from '../api/client';
import { imageNeedsProxy, imageUrl } from '../lib/media';
import { useArtworkPalette } from '../lib/palette';
import { useWash } from '../lib/wash';
import { useScrollFade } from '../hooks/use-scroll';

/**
 * Full-width colour wash behind the top of the page, taken from the page's artwork
 * (registered with `useHeaderWash`). Fades into the background and out as you scroll.
 */
export function HeaderWash() {
  const holder = useWash((s) => s.holder);
  const url = imageUrl(holder);
  const src = url && imageNeedsProxy(holder) ? proxyUrl(url) : url;
  const palette = useArtworkPalette(url);
  const ref = useRef<HTMLDivElement>(null);
  useScrollFade(ref);

  const visible = !!url;
  const top = palette?.top ?? 'transparent';
  const accent = palette?.vibrant ?? palette?.bottom ?? 'transparent';

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[480px] overflow-hidden transition-opacity duration-700"
      style={{ opacity: visible ? 'var(--scroll-fade, 1)' : 0 }}
    >
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-3xl saturate-150"
          style={{ animation: 'rise 600ms ease-out both' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
      <div
        className="absolute inset-0 transition-[background] duration-700"
        style={{
          background: `radial-gradient(110% 90% at 10% 0%, ${top} 0%, transparent 62%), radial-gradient(80% 80% at 90% 0%, ${accent} 0%, transparent 58%)`,
          opacity: 0.6,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/55 to-background" />
    </div>
  );
}
