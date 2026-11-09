import { useState } from 'react';
import { Music2 } from 'lucide-react';
import type { ImageHolder } from '../api/types';
import { proxyUrl } from '../api/client';
import { imageUrl } from '../lib/media';

/** Cover art with a skeleton while loading, a placeholder when missing, and a proxy fallback. */
export function Cover({
  holder, src, alt = '', className = '', rounded = 'rounded-md',
}: {
  holder?: ImageHolder | null;
  src?: string;
  alt?: string;
  className?: string;
  rounded?: string;
}) {
  const direct = src ?? imageUrl(holder);
  const [current, setCurrent] = useState<string | undefined>(direct);
  const [proxied, setProxied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [previous, setPrevious] = useState(direct);
  if (direct !== previous) {
    // The source changed (new track or item): start over.
    setPrevious(direct);
    setCurrent(direct);
    setProxied(false);
    setLoaded(false);
  }

  if (!current) {
    return (
      <div className={`${className} ${rounded} flex items-center justify-center bg-muted text-muted-foreground`} aria-hidden>
        <Music2 size={20} strokeWidth={1.75} />
      </div>
    );
  }
  return (
    <div className={`${className} ${rounded} relative overflow-hidden bg-muted`}>
      {!loaded && <div className="skeleton absolute inset-0" aria-hidden />}
      <img
        src={current}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onError={() => {
          if (!proxied && direct) {
            setProxied(true);
            setCurrent(proxyUrl(direct));
          } else {
            setCurrent(undefined);
          }
        }}
      />
    </div>
  );
}
