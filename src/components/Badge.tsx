// Status pill on a soft tint. Tones follow the design's colour meanings
// (design PDF page 3):
//   accent     blue: yours, your next step, new for you ("You're in", "New feedback")
//   good       green: approved, done
//   attention  yellow: pending, waiting on someone
//   fix        orange: a fix-it problem
//   quiet      grey: draft, closed, not chosen
// Use <StatusBadge> (in StatusBadge.tsx) for database statuses so labels stay consistent.
import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'accent' | 'good' | 'attention' | 'fix' | 'quiet';

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
