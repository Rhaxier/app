// One row of the staff queue (design PDF page 9): a coloured type chip, the
// item, who asked, how long it has waited, and the quick actions. On a
// laptop the rows line up as a table; on a phone each row stacks. Every kind
// of item (events, venues, fix-it, hours, reported content) uses this, so the
// queue reads as one list.
import type { ReactNode } from 'react';
import { Badge } from '@/components/Badge';
import { queueTypes, type QueueType } from '../logic';
import styles from './QueueRow.module.css';

interface QueueRowProps {
  type: QueueType;
  /** Usually a link to the item. */
  title: ReactNode;
  meta?: ReactNode;
  by: ReactNode;
  /** "2d" (see shortWait). */
  waiting: string;
  /** The longest wait in the queue gets flagged. */
  oldest?: boolean;
  actions: ReactNode;
  /** Anything else the row needs: an error message, a sheet. */
  children?: ReactNode;
}

export function QueueRow({
  type,
  title,
  meta,
  by,
  waiting,
  oldest,
  actions,
  children,
}: QueueRowProps) {
  const look = queueTypes[type];
  return (
    <article className={styles.row}>
      <span className={styles.type}>
        <Badge tone={look.tone}>{look.label}</Badge>
      </span>
      <div className={styles.item}>
        <h3 className={styles.title}>{title}</h3>
        {meta && <div className="meta">{meta}</div>}
      </div>
      <p className={styles.by}>{by}</p>
      <p className={oldest ? `${styles.waiting} ${styles.oldest}` : styles.waiting}>
        <span className="visually-hidden">Waiting </span>
        {waiting}
        {oldest && <span className="visually-hidden">, the longest</span>}
      </p>
      <div className={styles.actions}>{actions}</div>
      {children && <div className={styles.extra}>{children}</div>}
    </article>
  );
}

/** Column names above the rows, shown when the rows line up as a table. */
export function QueueHeading() {
  return (
    <div className={styles.heading} aria-hidden="true">
      <span>Type</span>
      <span>Item</span>
      <span>Requested by</span>
      <span>Waiting</span>
    </div>
  );
}
