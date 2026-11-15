import { useEffect, useState } from 'react';

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
