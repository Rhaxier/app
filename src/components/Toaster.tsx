// Draws the toasts from src/lib/toast.ts, just above the tab bar. They slide up
// and fade in, then fade out after a few seconds (or when dismissed).
//
// Screen readers: two hidden "live regions" are always on the page, empty
// until a toast arrives, which is what makes the announcement reliable. They
// hold only the words, so the Dismiss button isn't read out as part of the
// message. Success messages are polite (read after whatever is being read
// now); errors are assertive (read straight away). The error region has no
// role="alert", so it doesn't compete with the error text forms show.
import { useSyncExternalStore } from 'react';
import { dismissToast, getToasts, subscribeToToasts } from '@/lib/toast';
import { useListMotion } from '@/lib/useListMotion';
import { Icon } from './Icon';
import styles from './Toaster.module.css';

export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToToasts, getToasts);
  const rows = useListMotion(toasts, (toast) => String(toast.id));

  return (
    <>
      <div role="status" aria-live="polite" className="visually-hidden">
        {toasts
          .filter((toast) => toast.tone === 'success')
          .map((toast) => (
            <p key={toast.id}>{toast.message}</p>
          ))}
      </div>
      <div aria-live="assertive" className="visually-hidden" data-testid="toast-errors">
        {toasts
          .filter((toast) => toast.tone === 'error')
          .map((toast) => (
            <p key={toast.id}>{toast.message}</p>
          ))}
      </div>

      <div className={styles.stack}>
        {rows.map(({ item: toast, key, motion }) => (
          <div
            key={key}
            className={[styles.toast, styles[toast.tone], motion === 'leave' && styles.leaving]
              .filter(Boolean)
              .join(' ')}
          >
            <Icon name={toast.tone === 'error' ? 'alert' : 'check'} size={20} />
            <p className={styles.message}>{toast.message}</p>
            <button
              type="button"
              className={styles.dismiss}
              aria-label="Dismiss"
              onClick={() => dismissToast(toast.id)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
