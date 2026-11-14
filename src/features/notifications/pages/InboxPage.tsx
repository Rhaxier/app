// The inbox: every notification, newest first. Tapping one marks it read and
// opens the screen it's about. New ones arriving over Realtime slide in
// (useListMotion); the list doesn't animate when it first loads.
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { Button, ButtonLink } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { relativeTime } from '@/lib/dates';
import { useListMotion } from '@/lib/useListMotion';
import type { Notification } from '../api';
import { useMarkAllRead, useMarkRead, useNotifications } from '../hooks';
import styles from './InboxPage.module.css';

export function InboxPage() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  function open(notification: Notification) {
    if (!notification.read_at) markRead.mutate(notification.id);
    if (notification.link) navigate(notification.link);
  }

  const hasUnread = notifications.data?.some((item) => !item.read_at) ?? false;
  const rows = useListMotion(notifications.data, (item) => item.id);

  return (
    <div className="stack">
      <PageHeader
        back={{ to: '/', label: 'Home' }}
        title="Notifications"
        action={
          <ButtonLink to="/notifications/settings" variant="secondary" size="small" icon="settings">
            Settings
          </ButtonLink>
        }
      />

      {hasUnread && (
        <Button
          variant="ghost"
          size="small"
          className={styles.markAll}
          loading={markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          Mark all as read
        </Button>
      )}

      {notifications.isPending && <LoadingState />}
      {notifications.isError && (
        <ErrorState error={notifications.error} onRetry={() => notifications.refetch()} />
      )}
      {notifications.data?.length === 0 && (
        <EmptyState icon="bell" title="You're all caught up">
          Approvals, replies and updates will appear here.
        </EmptyState>
      )}

      {rows.length > 0 && (
        <ul className={`${styles.list} reveal stagger`}>
          {rows.map(({ item, key, motion }) => (
            <li key={key} className={motion}>
              <button
                type="button"
                className={['pressable', styles.item, !item.read_at && styles.unread]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => open(item)}
              >
                <span className={styles.dot} aria-hidden="true" />
                <span className={styles.content}>
                  <span className={styles.title}>
                    {!item.read_at && <span className="visually-hidden">Unread: </span>}
                    {item.title}
                  </span>
                  {item.body && <span className={styles.body}>{item.body}</span>}
                  <span className={styles.footer}>
                    <span className="meta">{relativeTime(item.created_at)}</span>
                    {item.urgent && <Badge tone="attention">Urgent</Badge>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
