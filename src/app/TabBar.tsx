// The bottom navigation (design PDF page 4, the hero use of liquid glass): a
// floating glass pill of tabs, and beside it a round glass search button.
//
// Like the iOS tab bar: the active tab sits in a raised glass "lens" that
// springs across when you pick another tab (one element shared between the
// tabs through Motion's layoutId), the icon and label colours cross-fade, and
// a tab shrinks a touch while pressed. The search button grows into the search
// overlay (SearchOverlay) and shrinks back into place when it closes.
//
// Students get five tabs; staff also get Approvals. On a phone narrower than
// 390px six tabs leave no room for the search button, so it moves into the
// Home header there instead (`crowded`).
import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useCurrentUser } from '@/features/auth/hooks';
import { SEARCH_MORPH_ID } from '@/features/search/context';
import { useSearchOverlay } from '@/features/search/hooks';
import { useFeatureVisible } from '@/features/settings/hooks';
import { spring } from '@/lib/motion';
import { isAdmin } from '@/lib/permissions';
import { isTabActive, tabsFor } from './tabs';
import styles from './TabBar.module.css';

/** The search button's size in px (its corner radius must be known for the morph). */
const SEARCH_SIZE = 50;

export function TabBar() {
  const user = useCurrentUser();
  const visible = useFeatureVisible(isAdmin(user));
  const { pathname } = useLocation();
  const search = useSearchOverlay();
  const tabs = tabsFor(user, visible);
  // While the overlay that grew out of the button is open, the button is the overlay.
  const morphedAway = search.open && search.origin === 'button';

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
                className={[styles.tab, active && styles.active, 'pressable']
                  .filter(Boolean)
                  .join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="tab-lens"
                    className={`lens ${styles.lens}`}
                    transition={spring.indicator}
                    aria-hidden="true"
                  />
                )}
                <Icon name={tab.icon} size={21} className={styles.icon} />
                <span className={styles.label}>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {morphedAway ? (
        <span className={styles.searchSpace} aria-hidden="true" />
      ) : (
        <motion.button
          type="button"
          layoutId={SEARCH_MORPH_ID}
          className={`glass tabglass pressable ${styles.search}`}
          style={{ borderRadius: SEARCH_SIZE / 2 }}
          transition={spring.sheet}
          aria-label="Search"
          aria-haspopup="dialog"
          onClick={() => search.openSearch('button')}
        >
          <Icon name="search" size={21} />
        </motion.button>
      )}
    </nav>
  );
}
