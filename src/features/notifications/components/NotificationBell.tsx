// The bell on Home. The dot appears live because useLiveNotifications (in
// the app layout) refetches the unread count whenever a notification arrives.
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useUnreadCount } from '../hooks';
import styles from './NotificationBell.module.css';

export function NotificationBell() {
  const { data: unread = 0 } = useUnreadCount();
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';
  return (
    <Link to="/notifications" className={`glass ${styles.bell} pressable`} aria-label={label}>
      <Icon name="bell" size={20} />
      {unread > 0 && <span className={styles.dot} aria-hidden="true" />}
    </Link>
  );
}
