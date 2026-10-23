// The admin dashboard's frame. On a laptop: the menu on the left, the chosen
// section on the right. On a phone the menu is its own screen (/admin) and
// each section opens full-screen with a back link (see AdminPage).
//
// Who gets in: RequireRole role="admin" around these routes (router.tsx) is a
// convenience; every table and function behind these screens refuses
// non-admins in the database.
import { Outlet } from 'react-router-dom';
import { useMediaQuery, WIDE_SCREEN } from '@/lib/useMediaQuery';
import { AdminMenu } from './AdminMenu';
import styles from './AdminLayout.module.css';

export function AdminLayout() {
  const wide = useMediaQuery(WIDE_SCREEN);
  if (!wide) return <Outlet />;
  return (
    <div className={styles.layout}>
      <aside className={styles.side}>
        <AdminMenu compact />
      </aside>
      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  );
}
