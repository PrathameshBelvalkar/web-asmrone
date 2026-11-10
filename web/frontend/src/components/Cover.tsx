import { useState } from 'react';
import { Music2 } from 'lucide-react';
import type { ImageHolder } from '../api/types';
import { proxyUrl } from '../api/client';
import { imageNeedsProxy, imageUrl } from '../lib/media';

/**
 * Cover art with a skeleton while loading, a placeholder when missing, and a proxy fallback.
 * `fit="contain"` shows the whole image (letterboxed) instead of filling and cropping the box.
 */
export function Cover({
  holder, src, alt = '', className = '', rounded = 'rounded-md', fit = 'cover',
}: {
  holder?: ImageHolder | null;
  src?: string;
  alt?: string;
  className?: string;
  rounded?: string;
  fit?: 'cover' | 'contain';
}) {
  const direct = src ?? imageUrl(holder);
  const needsProxy = src === undefined && imageNeedsProxy(holder);
  const initial = needsProxy && direct ? proxyUrl(direct) : direct;
  const [current, setCurrent] = useState<string | undefined>(initial);
  const [proxied, setProxied] = useState(needsProxy);
  const [loaded, setLoaded] = useState(false);
  const [previous, setPrevious] = useState(direct);
  if (direct !== previous) {
    // The source changed (new track or item): start over.
    setPrevious(direct);
    setCurrent(initial);
    setProxied(needsProxy);
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
        className={`h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
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
