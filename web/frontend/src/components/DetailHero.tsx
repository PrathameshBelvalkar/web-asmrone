import type { ReactNode } from 'react';
import { Play } from 'lucide-react';
import type { ImageHolder } from '../api/types';
import { useHeaderWash } from '../lib/wash';
import { Cover } from './Cover';
import { cn } from '@/lib/utils';

/** Long titles (works often have them) step down so they don't swamp the page. */
function titleSize(title: string): string {
  if (title.length > 70) return 'text-2xl @2xl:text-3xl';
  if (title.length > 32) return 'text-3xl @2xl:text-4xl';
  return 'text-4xl @2xl:text-6xl';
}

/**
 * Header for a work, artist or playlist (Apple Music / YouTube Music style): the page's colour wash
 * comes from the cover, which sits large beside an eyebrow, a big title, details and actions.
 */
export function DetailHero({
  cover, eyebrow, title, shape = 'square', meta, actions, children,
}: {
  cover: ImageHolder | null | undefined;
  eyebrow: string;
  title: string;
  /** `wide` shows the whole 4:3 cover (works); `round` for artists. */
  shape?: 'square' | 'wide' | 'round';
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  useHeaderWash(cover);
  return (
    // @container: the layout follows the hero's own width, which the sidebar narrows on tablets.
    <section className="@container mb-12 pt-2 sm:pt-4" style={{ animation: 'rise 400ms cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <div className={cn('flex flex-col gap-6 @2xl:flex-row @2xl:items-end @2xl:gap-9', shape === 'round' && 'items-center @2xl:items-end')}>
        <Cover
          holder={cover}
          fit={shape === 'wide' ? 'contain' : 'cover'}
          className={cn(
            'shrink-0 shadow-2xl shadow-black/60',
            shape === 'wide' && 'aspect-[4/3] w-full max-w-[380px] self-start bg-black/30 @2xl:w-80',
            shape === 'square' && 'aspect-square w-full max-w-[240px] @2xl:w-60',
            shape === 'round' && 'size-40 @2xl:size-52',
          )}
          rounded={shape === 'round' ? 'rounded-full' : 'rounded-2xl'}
        />
        <div className={cn('flex min-w-0 flex-1 flex-col justify-end', shape === 'round' && 'text-center @2xl:text-left')}>
          <p className="text-sm font-medium text-foreground/70">{eyebrow}</p>
          <h1 className={cn('mt-2 text-balance break-words font-semibold leading-[1.08] tracking-[-0.02em] [overflow-wrap:anywhere]', titleSize(title))}>
            {title}
          </h1>
          {meta && <div className="mt-4 text-sm text-foreground/70">{meta}</div>}
          {actions && <div className={cn('mt-6 flex flex-wrap items-center gap-3', shape === 'round' && 'justify-center @2xl:justify-start')}>{actions}</div>}
          {children}
        </div>
      </div>
    </section>
  );
}

/** The big round accent play button of a detail page. */
export function HeroPlayButton({ onClick, label = 'Play' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.97]"
    >
      <Play size={24} fill="currentColor" className="ml-1" aria-hidden />
    </button>
  );
}
