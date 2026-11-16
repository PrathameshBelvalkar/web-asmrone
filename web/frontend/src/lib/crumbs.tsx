import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/** One step of the breadcrumb trail. Items without `to` are the current page. */
export type Crumb = { label: string; to?: string };

/** Longest trail a detail page builds from where it was opened (Home › Search › Work › Artist). */
const MAX_TRAIL = 4;

interface CrumbState {
  items: Crumb[];
  setItems: (items: Crumb[]) => void;
  /** Trail of the page this one was opened from, with its last step linked back to it. */
  parent: Crumb[] | null;
}

const CrumbContext = createContext<CrumbState>({ items: [], setItems: () => {}, parent: null });

export function CrumbProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [items, setItemsState] = useState<Crumb[]>([]);
  // The last trail a page set, the URL it was set on, and that page's own parent trail.
  const last = useRef<{ items: Crumb[]; url: string; parent: Crumb[] | null } | null>(null);
  // Parent trail per history entry, fixed on first visit so back and forward keep it.
  const parents = useRef(new Map<string, Crumb[] | null>());
  const url = location.pathname + location.search;
  const urlRef = useRef(url);
  urlRef.current = url;

  // Worked out during render so the new page reads it on its first render. A new query on the same
  // path (a tab, a filter, a player opening) is the same page, so it keeps that page's parent.
  if (!parents.current.has(location.key)) {
    const from = last.current;
    const samePage = from !== null && from.url.split('?')[0] === location.pathname;
    parents.current.set(
      location.key,
      samePage
        ? from.parent
        : from && from.url !== url
          ? from.items.map((c, i) => (i === from.items.length - 1 ? { ...c, to: from.url } : c))
          : null,
    );
  }
  const parent = parents.current.get(location.key) ?? null;
  const parentRef = useRef(parent);
  parentRef.current = parent;

  const setItems = useCallback((next: Crumb[]) => {
    setItemsState(next);
    // Pages clear their trail on unmount; keep the last real one as the next page's parent.
    if (next.length) last.current = { items: next, url: urlRef.current, parent: parentRef.current };
  }, []);

  const value = useMemo(() => ({ items, setItems, parent }), [items, setItems, parent]);
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

/**
 * Trail for a detail page (work, artist, playlist, feed): where it was opened from, then `label`.
 * Opened from search, a work reads Home › “query” › Work. With no known origin (a reload or a
 * direct link) it uses `fallback`, Home by default.
 */
export function useDetailCrumbs(label: string, fallback: Crumb[] = [{ label: 'Home', to: '/' }]): void {
  const { parent } = useCrumbState();
  const base = parent ?? fallback;
  // Keep Home and the nearest steps when a chain of pages gets long.
  const trimmed = base.length > MAX_TRAIL - 1 ? [base[0], ...base.slice(base.length - (MAX_TRAIL - 2))] : base;
  useCrumbs([...trimmed, { label }]);
}

/** Search text for a breadcrumb: `$tag:Name$` tokens read as the tag name. */
export function searchLabel(query: string): string {
  return query.replace(/\$tag:([^$]+)\$/g, '$1').trim() || query;
}
