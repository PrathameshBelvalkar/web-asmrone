import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from './toast';

interface CatalogEvent {
  added: number;
  updated: number;
  removed: number;
}

/**
 * Listens for catalog changes while a Hanime page is shown (`/api/hanime/events`). On a change the
 * Hanime queries refresh, and new titles get a toast. The browser reconnects by itself if the stream drops.
 */
export function useHanimeEvents(enabled: boolean): void {
  const client = useQueryClient();
  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return;
    const source = new EventSource('/api/hanime/events');
    const onCatalog = (e: MessageEvent<string>) => {
      void client.invalidateQueries({ queryKey: ['hanime'] });
      try {
        const data = JSON.parse(e.data) as CatalogEvent;
        if (data.added > 0) toast(data.added === 1 ? '1 new hentai title' : `${data.added} new hentai titles`);
      } catch {
        // A malformed event still refreshed the lists.
      }
    };
    source.addEventListener('catalog', onCatalog);
    return () => {
      source.removeEventListener('catalog', onCatalog);
      source.close();
    };
  }, [enabled, client]);
}
