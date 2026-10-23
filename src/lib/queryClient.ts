// TanStack Query settings shared by every hook, and the one place that turns
// finished actions into toasts.
//
// A mutation opts in to a toast through its `meta`:
//   useMutation({ mutationFn, meta: { successMessage: 'Booking requested' } })
//   useMutation({ mutationFn, meta: { errorToast: true } })
// errorToast is for actions whose screen has nowhere to show an error (a
// button in a list, a toggle). Forms show their errors next to the fields.
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { errorMessage } from './errors';
import { showToast } from './toast';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Shown in a toast when the action works, e.g. "Booking requested". */
      successMessage?: string;
      /** Show a failure in a toast ("Couldn't save, try again" or the database's reason). */
      errorToast?: boolean;
    };
  }
}

export function createQueryClient({ retry = 1 }: { retry?: number | false } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data counts as fresh for 30 seconds, so moving between tabs doesn't
        // refetch everything. Realtime and mutations refresh what matters sooner.
        staleTime: 30_000,
        retry,
      },
    },
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _result, mutation) => {
        const message = mutation.meta?.successMessage;
        if (message) showToast(message);
      },
      onError: (error, _variables, _result, mutation) => {
        if (mutation.meta?.errorToast) showToast(toastErrorText(error), 'error');
      },
    }),
  });
}

/** The database's own reason when it gave one, otherwise a short generic line. */
export function toastErrorText(error: unknown): string {
  const text = errorMessage(error);
  return text === 'Something went wrong.' ? "Couldn't save, try again." : text;
}

export const queryClient = createQueryClient();
