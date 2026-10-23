// The bell on Home. The badge updates live because useLiveNotifications (in
// the app layout) refetches the unread count whenever a notification arrives.
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useUnreadCount } from '../hooks';
import styles from './NotificationBell.module.css';

export function NotificationBell() {
  const { data: unread = 0 } = useUnreadCount();
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';
  return (
    <Link to="/notifications" className={`${styles.bell} pressable`} aria-label={label}>
      <Icon name="bell" />
      {unread > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
