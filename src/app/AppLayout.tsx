// The frame around every signed-in screen: the navigation, a centred column
// for the screen, the search overlay (with ⌘K / Ctrl+K), and the things that
// run once per session (the live notification dot and phone push registration).
//
// The navigation depends on the screen (src/lib/layout.ts):
//   phone   the floating tab bar at the bottom, and a phone-width column
//           (wider for the staff desk view and the admin dashboard)
//   tablet  the glass icon rail on the left (SideNav)
//   laptop  the rail grows into a sidebar with labels; on the map and the
//           admin dashboard it stays a rail, so the plan, the admin menu and
//           the editors get the room
// On tablets and laptops each screen gets a width from screenWidths.ts, and
// <html> carries data-nav="rail" or "sidebar", so anything fixed to the
// screen (toasts, the map) can keep clear of the navigation (--nav-space).
//
// The column is a CSS container named "screen": screens lay themselves out by
// their own width (@container screen …), not the window's, so a two-column
// layout only appears when the column really has room. One side effect: the
// column is the frame for position: fixed inside it, so fixed chrome must be
// drawn outside it with PageChrome (as the map and the booking bar already are).
//
// Screen changes animate iOS-style (src/app/screenTransitions.ts): the new
// screen slides in from the right when you drill in, back from the left when
// you come out, and cross-fades between tabs. The leaving screen is lifted out
// of the page's flow while it fades (AnimatePresence's "popLayout"), so the
// new one takes its place at once and nothing jumps. Only the screen moves:
// the tab bar is outside it.
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect } from 'react';
import { ScrollRestoration, useLocation, useOutlet } from 'react-router-dom';
import { useCurrentUser } from '@/features/auth/hooks';
import { useLiveNotifications } from '@/features/notifications/hooks';
import { registerForPush } from '@/features/notifications/push';
import { SearchOverlayProvider } from '@/features/search/SearchOverlayProvider';
import { useLayoutMode, type LayoutMode } from '@/lib/layout';
import { screenVariants, useScreenTransition } from './screenTransitions';
import { screenWidth } from './screenWidths';
import { SideNav } from './SideNav';
import { SuspensionNotice } from './SuspensionNotice';
import { TabBar } from './TabBar';
import styles from './AppLayout.module.css';

type Nav = 'bar' | 'rail' | 'sidebar';

/** Screens that are a workspace, not a page: the rail leaves them the width. */
function isWorkspace(pathname: string): boolean {
  const onMap = pathname === '/map' || pathname === '/map/indoor';
  return onMap || pathname === '/admin' || pathname.startsWith('/admin/');
}

function navFor(mode: LayoutMode, pathname: string): Nav {
  if (mode === 'phone') return 'bar';
  return mode === 'laptop' && !isWorkspace(pathname) ? 'sidebar' : 'rail';
}

export function AppLayout() {
  const user = useCurrentUser();
  const { pathname } = useLocation();
  // The current screen as an element, kept by the leaving copy below so it
  // goes on showing the old screen while it animates out.
  const screen = useOutlet();
  const kind = useScreenTransition(pathname);
  const nav = navFor(useLayoutMode(), pathname);
  useLiveNotifications(user.id);

  useEffect(() => {
    registerForPush().catch((error) => console.warn('Push registration failed', error));
  }, []);

  // Before the first paint, so fixed chrome never draws under the navigation.
  // Removed again on sign-out (this layout goes away).
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (nav === 'bar') root.removeAttribute('data-nav');
    else root.setAttribute('data-nav', nav);
    return () => root.removeAttribute('data-nav');
  }, [nav]);

  // How wide this screen may grow on a tablet or laptop. On a phone only
  // "wide" matters: the desk view and admin screens use a wider column there.
  const width = screenWidth(pathname);

  return (
    <SearchOverlayProvider>
      <div className={styles.shell}>
        <a href="#main" className={styles.skip}>
          Skip to content
        </a>
        {/* Before the content, so the keyboard reaches it in the order it's seen. */}
        {nav !== 'bar' && <SideNav expanded={nav === 'sidebar'} />}
        <main id="main" className={`${styles.main} ${styles[width]}`}>
          <SuspensionNotice />
          <AnimatePresence mode="popLayout" initial={false} custom={kind}>
            <motion.div
              key={pathname}
              className={styles.screen}
              custom={kind}
              variants={screenVariants}
              initial="enter"
              animate="shown"
              exit="leave"
            >
              {screen}
            </motion.div>
          </AnimatePresence>
        </main>
        {nav === 'bar' && <TabBar />}
        <ScrollRestoration />
      </div>
    </SearchOverlayProvider>
  );
}
