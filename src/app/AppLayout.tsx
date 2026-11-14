// The frame around every signed-in screen: a centred phone-width column (wider
// for the staff desk view and the admin dashboard), the floating tab bar, the
// search overlay (with ⌘K / Ctrl+K), and the things that run once per session
// (the live notification dot and phone push registration).
//
// Screen changes animate iOS-style (src/app/screenTransitions.ts): the new
// screen slides in from the right when you drill in, back from the left when
// you come out, and cross-fades between tabs. The leaving screen is lifted out
// of the page's flow while it fades (AnimatePresence's "popLayout"), so the
// new one takes its place at once and nothing jumps. Only the screen moves:
// the tab bar is outside it.
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { ScrollRestoration, useLocation, useOutlet } from 'react-router-dom';
import { useCurrentUser } from '@/features/auth/hooks';
import { useLiveNotifications } from '@/features/notifications/hooks';
import { registerForPush } from '@/features/notifications/push';
import { SearchOverlayProvider } from '@/features/search/SearchOverlayProvider';
import { screenVariants, useScreenTransition } from './screenTransitions';
import { SuspensionNotice } from './SuspensionNotice';
import { TabBar } from './TabBar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const user = useCurrentUser();
  const { pathname } = useLocation();
  // The current screen as an element, kept by the leaving copy below so it
  // goes on showing the old screen while it animates out.
  const screen = useOutlet();
  const kind = useScreenTransition(pathname);
  useLiveNotifications(user.id);

  useEffect(() => {
    registerForPush().catch((error) => console.warn('Push registration failed', error));
  }, []);

  // Staff work at a laptop: the desk view and admin screens use the wide column.
  const wide = pathname === '/approvals' || pathname === '/admin' || pathname.startsWith('/admin/');

  return (
    <SearchOverlayProvider>
      <div className={styles.shell}>
        <a href="#main" className={styles.skip}>
          Skip to content
        </a>
        <main id="main" className={[styles.main, wide && styles.wide].filter(Boolean).join(' ')}>
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
        <TabBar />
        <ScrollRestoration />
      </div>
    </SearchOverlayProvider>
  );
}
