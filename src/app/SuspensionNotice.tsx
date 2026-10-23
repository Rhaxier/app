// The clear message for someone whose posting an admin has paused. Shown at
// the top of every screen until the pause ends. (The database refuses their
// new posts anyway, with the same explanation.)
import { useCurrentUser } from '@/features/auth/hooks';
import { formatDateTime } from '@/lib/dates';
import { Icon } from '@/components/Icon';
import styles from './Notices.module.css';

export function SuspensionNotice() {
  const user = useCurrentUser();
  const until = user.posting_suspended_until;
  if (!until || new Date(until) <= new Date()) return null;
  return (
    <div className={styles.notice} role="status">
      <Icon name="alert" size={20} />
      <p>
        <strong>Posting is paused on your account until {formatDateTime(until)}.</strong> You can
        still read everything.
        {user.suspension_reason ? ` Reason: ${user.suspension_reason}` : ''} If you think this is a
        mistake, talk to a teacher.
      </p>
    </div>
  );
}
