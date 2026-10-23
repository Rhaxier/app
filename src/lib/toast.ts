// Toasts: the small "Booking requested" / "Couldn't save, try again" messages.
//
// The list of toasts lives here, outside React, so anything can show one:
// a component, a hook, or the shared mutation handlers in queryClient.ts.
// <Toaster> (src/components/Toaster.tsx) draws them and announces them to
// screen readers. Each one disappears on its own after a few seconds.

export type ToastTone = 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

/** How long a toast stays. Errors stay a little longer, so there's time to read them. */
export const TOAST_MS: Record<ToastTone, number> = { success: 3000, error: 5000 };

// Never more than this many at once; the oldest makes way.
const MAX_TOASTS = 3;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function showToast(message: string, tone: ToastTone = 'success'): number {
  const id = nextId++;
  toasts = [...toasts, { id, message, tone }].slice(-MAX_TOASTS);
  emit();
  setTimeout(() => dismissToast(id), TOAST_MS[tone]);
  return id;
}

export function dismissToast(id: number): void {
  if (!toasts.some((toast) => toast.id === id)) return;
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

// For React's useSyncExternalStore (see Toaster.tsx).
export function subscribeToToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts(): Toast[] {
  return toasts;
}
