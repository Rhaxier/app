// The top of every screen, laid out like a native large-title screen (design
// PDF pages 7 and 8):
//
//   ‹ Home  or  EYEBROW                         right-hand meta or action
//   Large title
//   Subtitle
//
// The action (a round "+", a small button) sits on the top row, so the large
// title keeps the full width. `meta` is quiet caps text for that corner
// instead, e.g. "3 PROJECTS".
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { Icon } from './Icon';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  back?: { to: string; label: string };
  /** Quiet caps text in the top-right corner, e.g. "3 PROJECTS". */
  meta?: string;
  action?: ReactNode;
}

export function PageHeader({ title, eyebrow, subtitle, back, meta, action }: PageHeaderProps) {
  useDocumentTitle(title);
  const topRow = back || eyebrow || meta || action;

  return (
    <header className={styles.header}>
      {topRow && (
        <div className={styles.topRow}>
          {back ? (
            <Link to={back.to} className={`${styles.back} pressable`}>
              <Icon name="chevronLeft" size={18} />
              {back.label}
            </Link>
          ) : eyebrow ? (
            <p className={`label ${styles.eyebrow}`}>{eyebrow}</p>
          ) : (
            <span />
          )}
          {meta && <p className={`label ${styles.eyebrow}`}>{meta}</p>}
          {action}
        </div>
      )}
      {back && eyebrow && <p className={`label ${styles.eyebrow}`}>{eyebrow}</p>}
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </header>
  );
}

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
  /** Lets a <section aria-labelledby> point at this heading. */
  id?: string;
}

/** "ANNOUNCEMENTS ……… All": a caps label over a list, like a native grouped list. */
export function SectionHeader({ title, action, id }: SectionHeaderProps) {
  return (
    <div className={styles.section}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {action}
    </div>
  );
}
