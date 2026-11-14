// The bell on Home. The dot appears live because useLiveNotifications (in
// the app layout) refetches the unread count whenever a notification arrives.
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { spring } from '@/lib/motion';
import { useUnreadCount } from '../hooks';
import styles from './NotificationBell.module.css';

export function NotificationBell() {
  const { data: unread = 0 } = useUnreadCount();
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';
  return (
    <Link to="/notifications" className={`glass ${styles.bell} pressable`} aria-label={label}>
      <Icon name="bell" size={20} />
      {/* The dot pops in (from 60%, never from nothing) when something new arrives. */}
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
    </Link>
  );
}
