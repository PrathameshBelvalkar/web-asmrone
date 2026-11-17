import { ImageOff } from 'lucide-react';
import { MangaImage } from '../manga/MangaImage';

/**
 * An image from javdatabase.com, DMM or a studio's host. It tries the address, then the server's
 * proxy, then shows a placeholder; with no address it shows the placeholder straight away.
 */
export function JavImage({
  src, fallbacks, alt = '', className = '', imgClassName = 'h-full w-full object-cover', loading = 'lazy', style,
}: {
  src: string | null | undefined;
  fallbacks?: string[];
  alt?: string;
  className?: string;
  imgClassName?: string;
  loading?: 'lazy' | 'eager';
  style?: React.CSSProperties;
}) {
  if (!src) {
    return (
      <div style={style} className={`${className} flex items-center justify-center bg-muted text-muted-foreground`} aria-hidden>
        <ImageOff size={20} />
      </div>
    );
  }
  return (
    <MangaImage src={src} fallbacks={fallbacks} alt={alt} className={className} imgClassName={imgClassName} loading={loading} style={style} />
  );
}
