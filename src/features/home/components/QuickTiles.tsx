// The six tool tiles on Home (design: 3 × 2 grid, icon in a soft square).
// "Report issue" is orange because fix-it actions use the alert colour.
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';
import { useCurrentUser } from '@/features/auth/hooks';
import type { FeatureName } from '@/features/settings/api';
import { useFeatureVisible } from '@/features/settings/hooks';
import { isAdmin } from '@/lib/permissions';
import styles from './QuickTiles.module.css';

// Tiles for switched-off features are left out (Admin > System > Feature switches).
const tiles: {
  to: string;
  label: string;
  icon: IconName;
  feature: FeatureName;
  alert?: boolean;
}[] = [
  { to: '/map', label: 'Campus map', icon: 'map', feature: 'map' },
  { to: '/volunteer', label: 'Volunteer', icon: 'heart', feature: 'volunteering' },
  { to: '/projects', label: 'Projects', icon: 'folder', feature: 'projects' },
  { to: '/book', label: 'Book a venue', icon: 'calendar', feature: 'venues' },
  { to: '/collab', label: 'Collab finder', icon: 'users', feature: 'collab' },
  { to: '/map/report', label: 'Report issue', icon: 'camera', feature: 'fixit', alert: true },
];

export function QuickTiles() {
  const visible = useFeatureVisible(isAdmin(useCurrentUser()));
  return (
    <nav aria-label="Tools">
      <ul className={styles.grid}>
        {tiles
          .filter((tile) => visible(tile.feature))
          .map((tile) => (
            <li key={tile.to}>
              <Link to={tile.to} className={`${styles.tile} pressable`}>
                <span
                  className={[styles.icon, tile.alert && styles.alert].filter(Boolean).join(' ')}
                >
                  <Icon name={tile.icon} size={20} />
                </span>
                {tile.label}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}
