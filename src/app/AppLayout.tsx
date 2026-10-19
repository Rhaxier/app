// The frame around every signed-in screen: a centred phone-width column, the
// bottom tab bar, and the things that run once per session (the live
// notification badge and phone push registration).
import { useEffect } from 'react';
import { Outlet, ScrollRestoration } from 'react-router-dom';
import { useCurrentUser } from '@/features/auth/hooks';
import { useLiveNotifications } from '@/features/notifications/hooks';
import { registerForPush } from '@/features/notifications/push';
import { TabBar } from './TabBar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const user = useCurrentUser();
  useLiveNotifications(user.id);

  useEffect(() => {
    registerForPush().catch((error) => console.warn('Push registration failed', error));
  }, []);

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
      <TabBar />
      <ScrollRestoration />
    </div>
  );
}
