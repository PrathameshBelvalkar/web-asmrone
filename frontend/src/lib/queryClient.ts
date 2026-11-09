import { QueryClient } from '@tanstack/react-query';

/**
 * One app-wide cache. Content stays fresh for 10 minutes, so moving between pages reuses
 * what's already loaded instead of calling asmr.one again. Mutations update or invalidate it.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
