// Something a user reported with the Report button. Staff open it, then mark
// it actioned (e.g. after hiding the post) or dismiss it.
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import type { ContentReport } from '@/features/admin/api';
import { useSetContentReportStatus } from '@/features/admin/hooks';
import { useCurrentUser } from '@/features/auth/hooks';
import { relativeTime } from '@/lib/dates';
import { contentReportStatus } from '@/lib/status';
import styles from './QueueCard.module.css';

const targetLink: Record<string, (id: string) => string> = {
  collab_posts: (id) => `/collab/${id}`,
  announcements: (id) => `/announcements/${id}`,
  volunteer_events: (id) => `/volunteer/${id}`,
};

const targetName: Record<string, string> = {
  collab_posts: 'Collab post',
  announcements: 'Announcement',
  volunteer_events: 'Volunteering event',
};

export function ContentReportCard({ report }: { report: ContentReport }) {
  const user = useCurrentUser();
  const setStatus = useSetContentReportStatus(user.id);
  const link = targetLink[report.target_table]?.(report.target_id);
  return (
    <Card className={styles.card}>
      <div className={styles.top}>
        <h3>{targetName[report.target_table] ?? report.target_table}</h3>
        <StatusBadge map={contentReportStatus} status={report.status} />
      </div>
      <p>“{report.reason}”</p>
      <p className="meta">
        Reported by {report.reporter?.full_name ?? 'someone'} · {relativeTime(report.created_at)}
      </p>
      <div className={styles.actions}>
        {link && (
          <ButtonLink to={link} variant="ghost" size="small">
            Open
          </ButtonLink>
        )}
        {report.status === 'open' && (
          <>
            <Button
              variant="secondary"
              size="small"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ id: report.id, status: 'dismissed' })}
            >
              Dismiss
            </Button>
            <Button
              size="small"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ id: report.id, status: 'actioned' })}
            >
              Mark actioned
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
