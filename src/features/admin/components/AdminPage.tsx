// The frame of one admin section: title, a line saying what it's for, actions
// on the right, then the content. On a phone it also has a back link to the
// admin menu; on a laptop the side menu is always there instead.
//
// Forms and lists read best at a comfortable width, so the content stops at
// about 760px unless the section asks for the full width (the overview).
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { useMediaQuery, WIDE_SCREEN } from '@/lib/useMediaQuery';
import styles from './AdminPage.module.css';

interface AdminPageProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Use the whole width (dashboards). Default: a readable column. */
  fullWidth?: boolean;
  children: ReactNode;
}

export function AdminPage({ title, description, actions, fullWidth, children }: AdminPageProps) {
  const wide = useMediaQuery(WIDE_SCREEN);
  return (
    <div className={['stack', !fullWidth && styles.readable].filter(Boolean).join(' ')}>
      <PageHeader
        back={wide ? undefined : { to: '/admin', label: 'Admin' }}
        eyebrow={wide ? 'Admin' : undefined}
        title={title}
        subtitle={description}
        action={actions}
      />
      {children}
    </div>
  );
}
