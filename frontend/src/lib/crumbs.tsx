import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/** One step of the breadcrumb trail. Items without `to` are the current page. */
export type Crumb = { label: string; to?: string };

interface CrumbState {
  items: Crumb[];
  setItems: (items: Crumb[]) => void;
}

const CrumbContext = createContext<CrumbState>({ items: [], setItems: () => {} });

export function CrumbProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Crumb[]>([]);
  const value = useMemo(() => ({ items, setItems }), [items]);
  return <CrumbContext.Provider value={value}>{children}</CrumbContext.Provider>;
}

export function useCrumbState(): CrumbState {
  return useContext(CrumbContext);
}

/**
 * Set the breadcrumb trail for the page that calls it. The trail is cleared when the page unmounts.
 * Pass plain values: the trail is compared by its JSON, so new arrays with the same content are fine.
 */
export function useCrumbs(items: Crumb[]): void {
  const { setItems } = useCrumbState();
  const key = JSON.stringify(items);
  const apply = useCallback(() => setItems(JSON.parse(key) as Crumb[]), [key, setItems]);
  useEffect(() => {
    apply();
    return () => setItems([]);
  }, [apply, setItems]);
}
