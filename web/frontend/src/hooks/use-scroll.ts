import { useEffect, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** True once the window has scrolled past `threshold` pixels. Re-renders only when that flips. */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > threshold);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [threshold]);
  return scrolled;
}

/**
 * Fades an element out as the window scrolls, without re-rendering: writes its opacity directly.
 * Fully transparent after `distance` pixels.
 */
export function useScrollFade(ref: React.RefObject<HTMLElement | null>, distance = 420): void {
  useEffect(() => {
    let frame = 0;
    const apply = () => {
      frame = 0;
      const el = ref.current;
      if (el) el.style.setProperty('--scroll-fade', String(Math.max(0, 1 - window.scrollY / distance)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, distance]);
}

/**
 * Opens each new page at the top. The window keeps its scroll across client-side navigation, so
 * without this a link followed from far down one page lands part-way down the next. Back and Forward
 * (POP) are left alone so the browser can return you to where you were, and so is a link to a `#section`.
 * Only the path counts: changing a filter or opening the player (`?…`) keeps your place.
 */
export function useScrollToTopOnNavigate(): void {
  const { pathname, hash } = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    if (type !== 'POP' && !hash) window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new path scrolls; `type` and `hash` are read for it
  }, [pathname]);
}
