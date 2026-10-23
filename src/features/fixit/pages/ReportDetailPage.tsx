// One fix-it report: what's wrong, where, its status and history, "Me too",
// and the staff tools. Students never see who reported it (report_feed()
// returns no reporter for them).
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { formatDateTime } from '@/lib/dates';
import { isStaff } from '@/lib/permissions';
import { reportStatus } from '@/lib/status';
import { MeTooButton } from '../components/MeTooButton';
import { ReportPhoto } from '../components/ReportPhoto';
import { StaffReportPanel } from '../components/StaffReportPanel';
import { useReport } from '../hooks';
import { isOpen, reportLabel, reportSummary, reportTitle } from '../logic';
import styles from './ReportDetailPage.module.css';

export function ReportDetailPage() {
  const { id = '' } = useParams();
  const user = useCurrentUser();
  const report = useReport(id);

  const back = { to: '/map', label: 'Campus map' };
  if (report.isPending) return <LoadingState />;
  if (report.isError) return <ErrorState error={report.error} onRetry={() => report.refetch()} />;
  if (!report.data) {
    return (
      <div className="stack">
        <PageHeader back={back} title="Fix-it report" />
        <EmptyState icon="alert" title="Not found">
          It may have been resolved and closed.
        </EmptyState>
      </div>
    );
  }

  const item = report.data;
  return (
    <div className="stack">
      <PageHeader back={back} eyebrow={reportLabel(item)} title={reportTitle(item.description)} />

      <Card className="stack-tight">
        <div className="row-wrap">
          <StatusBadge map={reportStatus} status={item.status} />
          {item.urgent && <Badge tone="attention">Urgent</Badge>}
          <Badge tone="quiet">{item.category_name}</Badge>
        </div>
        {/* The title is the first line; show the rest only if there is more. */}
        {item.description.trim() !== reportTitle(item.description) && (
          <p className={styles.description}>{item.description}</p>
        )}
        {item.photo_path && (
          <ReportPhoto path={item.photo_path} alt={`Photo of: ${reportTitle(item.description)}`} />
        )}
        <p className="meta">{reportSummary(item)}</p>
        <dl className={styles.facts}>
          {item.room_code && (
            <>
              <dt>Where</dt>
              <dd>
                <Link to={`/map?room=${encodeURIComponent(item.room_code)}`}>
                  {item.room_name} ({item.room_code})
                </Link>
              </dd>
            </>
          )}
          <dt>Reported</dt>
          <dd>
            {formatDateTime(item.created_at)}
            {item.reported_by_me ? ' by you' : ''}
            {/* Only staff receive the reporter's name. */}
            {item.reporter_name && !item.reported_by_me ? ` by ${item.reporter_name}` : ''}
          </dd>
          {item.assigned_to_name && (
            <>
              <dt>Assigned to</dt>
              <dd>{item.assigned_to_name}</dd>
            </>
          )}
          {item.resolved_at && (
            <>
              <dt>Resolved</dt>
              <dd>{formatDateTime(item.resolved_at)}</dd>
            </>
          )}
          {item.duplicate_of && (
            <>
              <dt>Same as</dt>
              <dd>
                <Link to={`/reports/${item.duplicate_of}`}>the original report</Link>
              </dd>
            </>
          )}
        </dl>
        {item.status_note && <p className={styles.note}>{item.status_note}</p>}
      </Card>

      {isOpen(item.status) && (
        <MeTooButton
          reportId={item.id}
          count={item.vote_count}
          votedByMe={item.voted_by_me}
          reportedByMe={item.reported_by_me}
          fullWidth
        />
      )}

      {isStaff(user) && <StaffReportPanel key={`${item.id}-${item.status}`} report={item} />}
    </div>
  );
}
