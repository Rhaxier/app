// Top of Home (design PDF page 6): today's date in caps, the bell and your
// avatar (to "Me"), then a two-line greeting with your name in grey, and a
// line saying who you are and what's new for you.
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import type { CurrentUser } from '@/features/auth/api';
import { useCurrentUser } from '@/features/auth/hooks';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { useUnreadCount } from '@/features/notifications/hooks';
import { formatDate, greeting } from '@/lib/dates';
import { isStaff } from '@/lib/permissions';
import { responsibilityLabel, roleLabel } from '@/lib/status';
import styles from './HomeHeader.module.css';

/** Students by first name ("Sara."); staff in full, as the desk view greets them. */
function nameToGreet(user: CurrentUser): string {
  return isStaff(user) ? user.full_name : user.full_name.split(' ')[0];
}

/** "Grade 10 · 10B" for students; "Teacher · Venues" for staff. */
function whoLine(user: CurrentUser): string {
  if (!isStaff(user)) {
    return [user.grade ? `Grade ${user.grade}` : null, user.section].filter(Boolean).join(' · ');
  }
  const jobs = user.responsibilities.map((kind) => responsibilityLabel[kind]);
  return [roleLabel[user.role], ...jobs].join(' · ');
}

export function HomeHeader() {
  const user = useCurrentUser();
  const { data: unread = 0 } = useUnreadCount();
  const now = new Date();
  const who = whoLine(user);

  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        <p className="label">{formatDate(now)}</p>
        <div className={styles.actions}>
          {/* Only shown when six staff tabs crowd search out of the tab bar. */}
          {isStaff(user) && (
            <Link to="/search" className={`glass ${styles.search} pressable`} aria-label="Search">
              <Icon name="search" size={20} />
            </Link>
          )}
          <NotificationBell />
          <Link to="/me" className={`${styles.me} pressable`} aria-label={`Me: ${user.full_name}`}>
            <Avatar name={user.full_name} initials={user.avatar_initials} tone="ink" />
          </Link>
        </div>
      </div>
      <h1 className={styles.greeting}>
        {greeting(now)},<br />
        <span className={styles.name}>{nameToGreet(user)}.</span>
      </h1>
      <p className={styles.who}>
        {who}
        {who && unread > 0 && ' · '}
        {unread > 0 && (
          <Link to="/notifications" className={styles.unread}>
            {unread} new for you
          </Link>
        )}
      </p>
    </header>
  );
}
