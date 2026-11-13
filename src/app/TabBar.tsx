// The bottom navigation (design PDF page 4, the hero use of liquid glass): a
// floating glass pill of tabs, and beside it a round glass search button.
// The active tab sits in a raised "lens" and turns accent blue.
//
// Students get five tabs; staff also get Approvals. On a phone narrower than
// 375px six tabs leave no room for the search button, so it moves into the
// Home header there instead (`crowded`).
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
  const tabs = tabsFor(user, visible);
  const searching = pathname === '/search';

  return (
    <nav
      className={[styles.bar, tabs.length > 5 && styles.crowded].filter(Boolean).join(' ')}
      aria-label="Main"
    >
      <ul className={`glass tabglass ${styles.tabs}`}>
        {tabs.map((tab) => {
          const active = isTabActive(tab, pathname);
          return (
            <li key={tab.to}>
              <Link
                to={tab.to}
                className={[styles.tab, active && `lens ${styles.active}`, 'pressable']
                  .filter(Boolean)
                  .join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon name={tab.icon} size={21} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        to="/search"
        className={['glass tabglass pressable', styles.search, searching && styles.searching]
          .filter(Boolean)
          .join(' ')}
        aria-label="Search"
        aria-current={searching ? 'page' : undefined}
      >
        <Icon name="search" size={21} />
      </Link>
    </nav>
  );
}
