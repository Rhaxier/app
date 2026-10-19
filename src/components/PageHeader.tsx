// The top of every screen: optional back link, small eyebrow text, the page
// title (Bricolage Grotesque), a subtitle, and an optional action on the right
// (e.g. the round "+" button or the floor switcher).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  back?: { to: string; label: string };
  action?: ReactNode;
}

export function PageHeader({ title, eyebrow, subtitle, back, action }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {back && (
        <Link to={back.to} className={styles.back}>
          <Icon name="chevronLeft" size={18} />
          {back.label}
        </Link>
      )}
      <div className={styles.row}>
        <div className={styles.titles}>
          {eyebrow && <p className="meta">{eyebrow}</p>}
          <h1>{title}</h1>
          {subtitle && <p className="meta">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
}

/** "Announcements ……… See all" */
export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className={styles.section}>
      <h2>{title}</h2>
      {action}
    </div>
  );
}
