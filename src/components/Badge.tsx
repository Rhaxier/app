// Status pill on a soft tint. Tones follow the design:
// good = teal soft, attention = orange soft (waiting / needs action), quiet = draft or closed.
// Use <StatusBadge> (in StatusBadge.tsx) for database statuses so labels stay consistent.
import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'good' | 'attention' | 'quiet';

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
