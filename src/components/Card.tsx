// White rounded panel: the main surface of every screen. `tone="accent"` is the
// teal card used for pinned announcements; `tone="alert"` the orange one for
// emergency announcements.
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'article' | 'section' | 'li';
  tone?: 'default' | 'accent' | 'alert';
  /** No inner padding, for cards whose content runs edge to edge (lists, maps). */
  flush?: boolean;
  children: ReactNode;
}

export function Card({
  as: Tag = 'div',
  tone = 'default',
  flush,
  className,
  children,
  ...rest
}: CardProps) {
  const classNames = [
    styles.card,
    tone === 'accent' && styles.accent,
    tone === 'alert' && styles.alert,
    flush && styles.flush,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={classNames} {...rest}>
      {children}
    </Tag>
  );
}
