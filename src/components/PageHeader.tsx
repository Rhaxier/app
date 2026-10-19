// The top of every screen: optional back link, small eyebrow text, the page
// title (Bricolage Grotesque), a subtitle, and an optional action on the right
// (e.g. the round "+" button or the floor switcher).
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { school } from '@/config/school';
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
  // The browser tab (and screen readers on page change) name the screen.
  useEffect(() => {
    document.title = `${title} · ${school.appName}`;
  }, [title]);

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
  /** Lets a <section aria-labelledby> point at this heading. */
  id?: string;
}

/** "Announcements ……… See all" */
export function SectionHeader({ title, action, id }: SectionHeaderProps) {
  return (
    <div className={styles.section}>
      <h2 id={id}>{title}</h2>
      {action}
    </div>
  );
}
