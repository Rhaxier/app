// The three non-happy states every list screen needs: loading, error, empty.
// Keeping them here means every screen says "nothing here yet" the same way.
import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/errors';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import styles from './States.module.css';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      {label}
    </div>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className={styles.box} role="alert">
      <span className={`${styles.icon} ${styles.iconAlert}`}>
        <Icon name="alert" />
      </span>
      <p className={styles.title}>Couldn't load this</p>
      <p className="meta">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="small" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon = 'sparkle', title, children, action }: EmptyStateProps) {
  return (
    <div className={styles.box}>
      <span className={styles.icon}>
        <Icon name={icon} />
      </span>
      <p className={styles.title}>{title}</p>
      {children && <p className="meta">{children}</p>}
      {action}
    </div>
  );
}
