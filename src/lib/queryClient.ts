// TanStack Query settings shared by every hook.
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data counts as fresh for 30 seconds, so moving between tabs doesn't
      // refetch everything. Realtime and mutations refresh what matters sooner.
      staleTime: 30_000,
      retry: 1,
    },
  },
});
