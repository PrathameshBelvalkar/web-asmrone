import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toolsBusy, toolsOptions } from '../api/queries';
import { toast } from '../lib/toast';

/**
 * Says "AI subtitles are ready" once, when setup finishes while the app is open. It polls only
 * while AI subtitles are on and not yet ready (and while setup is busy).
 */
export function useToolsReadyToast(): void {
  const query = useQuery({
    ...toolsOptions(),
    refetchInterval: (q) => {
      const data = q.state.data;
      if (data?.enabled && !data.ready) return 2000;
      return toolsBusy(data) ? 1000 : false;
    },
  });
  const ready = query.data?.ready;
  const wasReady = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (ready === undefined) return;
    if (wasReady.current === false && ready) toast('AI subtitles are ready');
    wasReady.current = ready;
  }, [ready]);
}
