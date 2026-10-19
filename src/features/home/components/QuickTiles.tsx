// The six tool tiles on Home (design: 3 × 2 grid, icon in a soft square).
// "Report issue" is orange because fix-it actions use the alert colour.
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';
import styles from './QuickTiles.module.css';

const tiles: { to: string; label: string; icon: IconName; alert?: boolean }[] = [
  { to: '/map', label: 'Campus map', icon: 'map' },
  { to: '/volunteer', label: 'Volunteer', icon: 'heart' },
  { to: '/projects', label: 'Projects', icon: 'folder' },
  { to: '/book', label: 'Book a venue', icon: 'calendar' },
  { to: '/collab', label: 'Collab finder', icon: 'users' },
  { to: '/map/report', label: 'Report issue', icon: 'camera', alert: true },
];

export function QuickTiles() {
  return (
    <nav aria-label="Tools">
      <ul className={styles.grid}>
        {tiles.map((tile) => (
          <li key={tile.to}>
            <Link to={tile.to} className={styles.tile}>
              <span className={[styles.icon, tile.alert && styles.alert].filter(Boolean).join(' ')}>
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
