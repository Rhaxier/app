// The navigation on tablets and laptops (src/lib/layout.ts): the bottom tab
// bar's tabs, turned sideways into a floating glass column on the left.
//
//   rail      tablets (and the admin dashboard): icons with small labels
//   expanded  laptops: icons with full-size labels
//
// It is the same navigation as the tab bar, not a new one: the same tabs
// (tabsFor), the same raised lens springing to the active tab, and the same
// search button that grows into the search overlay. It also holds the bell
// and your avatar (to Me), which on a phone live in the Home header: here
// they're reachable from every screen.
//
// It sits on glass, so nothing inside it is glass (never glass on glass):
// the search button and the active lens are soft fills, as in the tab bar.
import { AnimatePresence, motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { useCurrentUser } from '@/features/auth/hooks';
import { useUnreadCount } from '@/features/notifications/hooks';
import { SEARCH_MORPH_ID } from '@/features/search/context';
import { useSearchOverlay } from '@/features/search/hooks';
import { useFeatureVisible } from '@/features/settings/hooks';
import { spring } from '@/lib/motion';
import { isAdmin, isStaff } from '@/lib/permissions';
import { roleLabel } from '@/lib/status';
import { isTabActive, tabsFor } from './tabs';
import styles from './SideNav.module.css';

/** The search button's corner radius in px, for the morph into the overlay. */
const SEARCH_RADIUS = { rail: 25, expanded: 22 };

/** "⌘K" on a Mac or iPad keyboard, "Ctrl K" elsewhere (the shortcut in SearchOverlayProvider). */
function shortcutLabel(): string {
  const platform =
    typeof navigator === 'undefined' ? '' : navigator.platform || navigator.userAgent;
  return /Mac|iPhone|iPad/.test(platform) ? '⌘K' : 'Ctrl K';
}

export function SideNav({ expanded }: { expanded: boolean }) {
  const user = useCurrentUser();
  const visible = useFeatureVisible(isAdmin(user));
  const { pathname } = useLocation();
  const search = useSearchOverlay();
  const { data: unread = 0 } = useUnreadCount();
  const tabs = tabsFor(user, visible);
  // While the overlay that grew out of the button is open, the button is the overlay.
  const morphedAway = search.open && search.origin === 'button';

  // The bell and Me have their own rows here, so they light up instead of Home.
  const onInbox = pathname === '/notifications' || pathname.startsWith('/notifications/');
  const onMe = pathname === '/me';
  const radius = expanded ? SEARCH_RADIUS.expanded : SEARCH_RADIUS.rail;
  const bellLabel = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';
  const who = isStaff(user) ? roleLabel[user.role] : user.grade ? `Grade ${user.grade}` : '';

  return (
    <nav
      className={`glass tabglass ${styles.nav} ${expanded ? styles.expanded : styles.rail}`}
      aria-label="Main"
    >
      <div className={styles.searchSlot}>
        {morphedAway ? (
          <span className={styles.searchSpace} aria-hidden="true" />
        ) : (
          <motion.button
            type="button"
            layoutId={SEARCH_MORPH_ID}
            className={`${styles.search} pressable`}
            style={{ borderRadius: radius }}
            transition={spring.sheet}
            aria-label={expanded ? undefined : 'Search'}
            aria-haspopup="dialog"
            onClick={() => search.openSearch('button')}
          >
            <Icon name="search" size={20} />
            {expanded && (
              <>
                <span className={styles.searchText}>Search</span>
                <kbd className={styles.shortcut} aria-hidden="true">
                  {shortcutLabel()}
                </kbd>
              </>
            )}
          </motion.button>
        )}
      </div>

      <ul className={styles.tabs}>
        {tabs.map((tab) => {
          const active = !onInbox && !onMe && isTabActive(tab, pathname);
          return (
            <li key={tab.to}>
              <Link
                to={tab.to}
                className={[styles.item, active && styles.active, 'pressable']
                  .filter(Boolean)
                  .join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                {active && <Lens />}
                <Icon name={tab.icon} size={22} className={styles.icon} />
                <span className={styles.label}>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className={styles.account}>
        <Link
          to="/notifications"
          className={[styles.item, styles.accountItem, onInbox && styles.active, 'pressable']
            .filter(Boolean)
            .join(' ')}
          aria-current={onInbox ? 'page' : undefined}
          aria-label={expanded ? undefined : bellLabel}
        >
          {onInbox && <Lens />}
          <span className={styles.bell}>
            <Icon name="bell" size={22} className={styles.icon} />
            {/* The same live dot as the Home bell (NotificationBell). */}
            <AnimatePresence initial={false}>
              {unread > 0 && (
                <motion.span
                  className={styles.dot}
                  aria-hidden="true"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={spring.pop}
                />
              )}
            </AnimatePresence>
          </span>
          {expanded && (
            <span className={styles.label}>
              Notifications
              {unread > 0 && <span className="visually-hidden">, {unread} unread</span>}
            </span>
          )}
        </Link>
        <Link
          to="/me"
          className={[
            styles.item,
            styles.accountItem,
            styles.me,
            onMe && styles.active,
            'pressable',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-current={onMe ? 'page' : undefined}
          aria-label={expanded ? undefined : `Me: ${user.full_name}`}
        >
          {onMe && <Lens />}
          <span className={styles.icon}>
            <Avatar name={user.full_name} initials={user.avatar_initials} size="small" tone="ink" />
          </span>
          {expanded && (
            <span className={styles.meText}>
              <span className={styles.meName}>{user.full_name}</span>
              {who && <span className="meta">{who}</span>}
            </span>
          )}
        </Link>
      </div>
    </nav>
  );
}

/** The raised lens behind the active row: one element that springs from row to row. */
function Lens() {
  return (
    <motion.span
      layoutId="side-lens"
      className={`lens ${styles.lens}`}
      transition={spring.indicator}
      aria-hidden="true"
    />
  );
}
