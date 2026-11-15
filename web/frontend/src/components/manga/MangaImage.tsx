import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { proxyUrl } from '../../api/client';

/**
 * An image from the manga host. On error it tries each fallback address, then the same addresses
 * through the server's proxy, then shows a placeholder. The box keeps its size while loading, so
 * pages don't jump.
 */
export function MangaImage({
  src, fallbacks = [], alt = '', className = '', imgClassName = '', style, loading = 'lazy', onRetry,
}: {
  src: string;
  fallbacks?: string[];
  alt?: string;
  className?: string;
  imgClassName?: string;
  /** On the outer box, for example an aspect ratio so the box has its size before the image loads. */
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
  /** Shown as a button on the placeholder when given. */
  onRetry?: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [previous, setPrevious] = useState(src);
  if (src !== previous) {
    setPrevious(src);
    setAttempt(0);
    setLoaded(false);
  }
  const direct = [src, ...fallbacks];
  const candidates = [...direct, ...direct.map(proxyUrl)];
  const current = candidates[attempt];

  if (current === undefined) {
    return (
      <div style={style} className={`${className} flex flex-col items-center justify-center gap-3 bg-muted text-muted-foreground`}>
        <ImageOff size={22} aria-hidden />
        {onRetry && (
          <button
            type="button"
            className="rounded-full border px-3 py-1 text-xs hover:bg-accent"
            onClick={() => {
              setAttempt(0);
              onRetry();
            }}
          >
            Try again
          </button>
        )}
      </div>
    );
  }
  return (
    <div style={style} className={`${className} relative overflow-hidden bg-muted`}>
      {!loaded && <div className="skeleton absolute inset-0" aria-hidden />}
      <img
        src={current}
        alt={alt}
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setAttempt((n) => n + 1)}
        className={`${imgClassName} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
