// The bottom tab bar (78px, white, top border). The active tab is teal.
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useCurrentUser } from '@/features/auth/hooks';
import { useFeatureVisible } from '@/features/settings/hooks';
import { isAdmin } from '@/lib/permissions';
import { isTabActive, tabsFor } from './tabs';
import styles from './TabBar.module.css';

export function TabBar() {
  const user = useCurrentUser();
  const visible = useFeatureVisible(isAdmin(user));
  const { pathname } = useLocation();

  return (
    <nav className={styles.bar} aria-label="Main">
      <ul className={styles.list}>
        {tabsFor(user, visible).map((tab) => (
          <li key={tab.to}>
            <Link
              to={tab.to}
              className={`${styles.tab} pressable`}
              aria-current={isTabActive(tab, pathname) ? 'page' : undefined}
            >
              <Icon name={tab.icon} />
              <span>{tab.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
