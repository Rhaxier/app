// The frame around every signed-in screen: a centred phone-width column (wider
// for the admin dashboard), the bottom tab bar, and the things that run once
// per session (the live notification badge and phone push registration).
import { useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/features/auth/hooks';
import { useLiveNotifications } from '@/features/notifications/hooks';
import { registerForPush } from '@/features/notifications/push';
import { motionMs } from '@/lib/motion';
import { SuspensionNotice } from './SuspensionNotice';
import { TabBar } from './TabBar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const user = useCurrentUser();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useLiveNotifications(user.id);

  useEffect(() => {
    registerForPush().catch((error) => console.warn('Push registration failed', error));
  }, []);

  // Screen changes animate with the View Transitions API (screenTransitions.ts).
  // Browsers without it get a plain fade-in of the new screen instead.
  useEffect(() => {
    const main = mainRef.current;
    const duration = motionMs('base');
    if ('startViewTransition' in document || !main?.animate || duration === 0) return;
    main.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'ease-out' });
  }, [pathname]);

  const wide = pathname === '/admin' || pathname.startsWith('/admin/');

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <main
        id="main"
        ref={mainRef}
        className={[styles.main, wide && styles.wide].filter(Boolean).join(' ')}
      >
        <SuspensionNotice />
        <Outlet />
      </main>
      <TabBar />
      <ScrollRestoration />
    </div>
  );
}
