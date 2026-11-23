// The school's look and any maintenance notice, read once at start-up from
// public_status() (it works before sign-in, so the sign-in screen has them):
//   * Branding sets the accent from Admin > System > Branding. tokens.css
//     reads --brand-acc-light / --brand-acc-dark (and their soft tints) when
//     they're set, and falls back to the design's system blue when they're not.
//     One colour can't suit both themes, so dark mode gets a lighter mix of it
//     (brandAccents in src/lib/contrast.ts).
//   * MaintenanceBanner shows the admin's message at the top of every screen
//     until its end time.
import { useEffect } from 'react';
import { Icon } from '@/components/Icon';
import { usePublicStatus } from '@/features/settings/hooks';
import { accentProblem, brandAccents } from '@/lib/contrast';
import { formatDateTime } from '@/lib/dates';
import { rememberBrand } from '@/lib/splash';
import styles from './Notices.module.css';

/**
 * The database's default accent_color. It means "no school colour": the app
 * uses the design's system blue. (The blue itself can't be stored: white text
 * on it is below the 4.5:1 the database asks of a school colour.)
 */
export const DEFAULT_ACCENT = '#0e6857';

const BRAND_PROPERTIES = [
  '--brand-acc-light',
  '--brand-accsoft-light',
  '--brand-acc-dark',
  '--brand-accsoft-dark',
];

export function Branding() {
  const status = usePublicStatus().data;
  const accent = status?.accent_color;

  // The crest and name for the next start's loading screen (src/lib/splash.ts).
  const logo = status?.logo_url ?? null;
  const name = status?.school_name ?? null;
  useEffect(() => {
    if (status) rememberBrand({ logo, name });
  }, [status, logo, name]);

  useEffect(() => {
    const root = document.documentElement.style;
    // The database only stores colours that pass; checking again costs nothing.
    if (!accent || accent.toLowerCase() === DEFAULT_ACCENT || accentProblem(accent)) {
      BRAND_PROPERTIES.forEach((name) => root.removeProperty(name));
      return;
    }
    const brand = brandAccents(accent);
    root.setProperty('--brand-acc-light', brand.light);
    root.setProperty('--brand-accsoft-light', brand.lightSoft);
    root.setProperty('--brand-acc-dark', brand.dark);
    root.setProperty('--brand-accsoft-dark', brand.darkSoft);
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
