// The six tools on Home (design PDF page 6: "Six tools, one calm grid"): one
// card split by hairlines, not six separate cards. Each tool has a line icon,
// its name, a small count, and a dot when there's something new (blue) or
// something broken (orange).
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';
import { useCurrentUser } from '@/features/auth/hooks';
import type { FeatureName } from '@/features/settings/api';
import { useFeatureVisible } from '@/features/settings/hooks';
import { isAdmin } from '@/lib/permissions';
import { useToolHints } from '../hooks';
import type { ToolKey } from '../logic';
import styles from './QuickTiles.module.css';

// Tiles for switched-off features are left out (Admin > System > Feature switches).
const tiles: { key: ToolKey; to: string; label: string; icon: IconName; feature: FeatureName }[] = [
  { key: 'map', to: '/map', label: 'Map', icon: 'map', feature: 'map' },
  {
    key: 'volunteer',
    to: '/volunteer',
    label: 'Volunteer',
    icon: 'heart',
    feature: 'volunteering',
  },
  { key: 'projects', to: '/projects', label: 'Projects', icon: 'folder', feature: 'projects' },
  { key: 'book', to: '/book', label: 'Book', icon: 'calendar', feature: 'venues' },
  { key: 'collab', to: '/collab', label: 'Collab', icon: 'users', feature: 'collab' },
  { key: 'report', to: '/map/report', label: 'Report', icon: 'wrench', feature: 'fixit' },
];

const dotWords = { new: 'new for you', problem: 'needs fixing' };

export function QuickTiles() {
  const visible = useFeatureVisible(isAdmin(useCurrentUser()));
  const hints = useToolHints();
  return (
    <nav aria-label="Tools">
      <ul className={`${styles.grid} stagger`}>
        {tiles
          .filter((tile) => visible(tile.feature))
          .map((tile) => {
            const hint = hints[tile.key];
            return (
              <li key={tile.key}>
                <Link to={tile.to} className={`${styles.tile} pressable`}>
                  <Icon name={tile.icon} size={21} className={styles.icon} />
                  {hint.dot && (
                    <span className={`${styles.dot} ${styles[hint.dot]}`}>
                      <span className="visually-hidden">{dotWords[hint.dot]}</span>
                    </span>
                  )}
                  <span className={styles.label}>{tile.label}</span>
                  <span className={styles.sub}>{hint.sub}</span>
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}
