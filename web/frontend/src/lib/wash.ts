import { useEffect } from 'react';
import { create } from 'zustand';
import type { ImageHolder } from '../api/types';
import { imageUrl } from './media';

/**
 * The artwork behind the current page's header colour wash (YouTube Music / Apple Music style).
 * Pages register their cover with `useHeaderWash`; the Shell draws the wash full-width behind them.
 */
export const useWash = create<{ holder: ImageHolder | null }>(() => ({ holder: null }));

export function useHeaderWash(holder: ImageHolder | null | undefined): void {
  const key = imageUrl(holder) ?? '';
  useEffect(() => {
    useWash.setState({ holder: key ? holder ?? null : null });
    return () => useWash.setState({ holder: null });
    // Keyed by the image URL so a new object for the same cover doesn't restart the wash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
