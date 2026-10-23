// The school's look and any maintenance notice, read once at start-up from
// public_status() (it works before sign-in, so the sign-in screen has them):
//   * Branding sets --color-accent (and its pale tint) from Admin > System >
//     Branding. The default teal from tokens.css is left alone.
//   * MaintenanceBanner shows the admin's message at the top of every screen
//     until its end time.
import { useEffect } from 'react';
import { Icon } from '@/components/Icon';
import { usePublicStatus } from '@/features/settings/hooks';
import { accentSoftFor, accentProblem } from '@/lib/contrast';
import { formatDateTime } from '@/lib/dates';
import styles from './Notices.module.css';

export const DEFAULT_ACCENT = '#0e6857';

export function Branding() {
  const accent = usePublicStatus().data?.accent_color;

  useEffect(() => {
    const root = document.documentElement.style;
    // The database only stores colours that pass; checking again costs nothing.
    if (!accent || accent.toLowerCase() === DEFAULT_ACCENT || accentProblem(accent)) {
      root.removeProperty('--color-accent');
      root.removeProperty('--color-accent-soft');
      return;
    }
    root.setProperty('--color-accent', accent);
    root.setProperty('--color-accent-soft', accentSoftFor(accent));
  }, [accent]);

  return null;
}

export function MaintenanceBanner() {
  const status = usePublicStatus().data;
  if (!status?.maintenance_message) return null;
  return (
    <div className={`${styles.notice} ${styles.banner}`} role="status">
      <Icon name="settings" size={20} />
      <p>
        {status.maintenance_message}
        {status.maintenance_until ? ` (until ${formatDateTime(status.maintenance_until)})` : ''}
      </p>
    </div>
  );
}
