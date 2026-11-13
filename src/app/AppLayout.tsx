// The frame around every signed-in screen: a centred phone-width column (wider
// for the staff desk view and the admin dashboard), the floating tab bar, and
// the things that run once per session (the live notification dot, phone push
// registration, and ⌘K / Ctrl+K to jump to search from anywhere).
import { useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  useLiveNotifications(user.id);

  // "⌘K jumps anywhere" (design PDF page 9): the search screen finds rooms,
  // events, announcements and collab posts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        navigate('/search');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

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

  // Staff work at a laptop: the desk view and admin screens use the wide column.
  const wide = pathname === '/approvals' || pathname === '/admin' || pathname.startsWith('/admin/');

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
