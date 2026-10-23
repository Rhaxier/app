// Top of Home: today's date, a greeting, your avatar (to "Me") and the bell.
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { useCurrentUser } from '@/features/auth/hooks';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { formatDayHeading, greeting } from '@/lib/dates';
import styles from './HomeHeader.module.css';

export function HomeHeader() {
  const user = useCurrentUser();
  const now = new Date();
  return (
    <header className={styles.header}>
      <div>
        <p className="meta">{formatDayHeading(now)}</p>
        <h1 className={styles.greeting}>{greeting(now)}</h1>
      </div>
      <div className={styles.actions}>
        <Link to="/me" className={`${styles.me} pressable`} aria-label={`Me: ${user.full_name}`}>
          <Avatar name={user.full_name} initials={user.avatar_initials} tone="quiet" />
        </Link>
        <NotificationBell />
      </div>
    </header>
  );
}
