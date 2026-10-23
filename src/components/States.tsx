// The three non-happy states every list screen needs: loading, error, empty.
// Keeping them here means every screen says "nothing here yet" the same way.
//
// Loading shows grey "skeleton" shapes where the content will go, instead of
// a spinner, so the screen doesn't jump when the data arrives. Cards fade in
// when they appear (Card.module.css), which cross-fades skeleton to content.
import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/errors';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import styles from './States.module.css';

/** The shape of what's loading: cards (most lists), slim rows, booking slots or one big block. */
export type SkeletonShape = 'card' | 'row' | 'slot' | 'block';

interface LoadingStateProps {
  /** Read out by screen readers; nobody sees it. */
  label?: string;
  shape?: SkeletonShape;
  count?: number;
}

export function LoadingState({ label = 'Loading…', shape = 'card', count = 3 }: LoadingStateProps) {
  return (
    <div className={styles.skeletons} role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {shape === 'slot' ? (
        <div className={`${styles.skeleton} ${styles.slots}`} aria-hidden="true">
          {Array.from({ length: count + 2 }, (_, index) => (
            <span key={index} className={styles.slotRow}>
              <span className={`${styles.bar} ${styles.barTime}`} />
              <span className={`${styles.bar} ${styles.barSlot}`} />
            </span>
          ))}
        </div>
      ) : (
        Array.from({ length: shape === 'block' ? 1 : count }, (_, index) => (
          <div key={index} className={`${styles.skeleton} ${styles[shape]}`} aria-hidden="true">
            {shape !== 'block' && <span className={`${styles.bar} ${styles.barTitle}`} />}
            {shape === 'card' && (
              <>
                <span className={styles.bar} />
                <span className={`${styles.bar} ${styles.barShort}`} />
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/** A small spinner, for the rare place too small for a skeleton (inside a button row). */
export function InlineLoading({ label = 'Loading…' }: { label?: string }) {
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
