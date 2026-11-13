// Something a user reported with the Report button. Staff open it, then mark
// it actioned (e.g. after hiding the post) or dismiss it.
import { Button, ButtonLink } from '@/components/Button';
import type { ContentReport } from '@/features/admin/api';
import { useSetContentReportStatus } from '@/features/admin/hooks';
import { useCurrentUser } from '@/features/auth/hooks';
import { shortWait } from '../logic';
import { QueueRow } from './QueueRow';

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

interface ContentReportCardProps {
  report: ContentReport;
  oldest?: boolean;
}

export function ContentReportCard({ report, oldest }: ContentReportCardProps) {
  const user = useCurrentUser();
  const setStatus = useSetContentReportStatus(user.id);
  const link = targetLink[report.target_table]?.(report.target_id);
  return (
    <QueueRow
      type="content"
      title={targetName[report.target_table] ?? report.target_table}
      meta={<>“{report.reason}”</>}
      by={report.reporter?.full_name ?? 'Someone'}
      waiting={shortWait(report.created_at)}
      oldest={oldest}
      actions={
        <>
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
        </>
      }
    />
  );
}
