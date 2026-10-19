// A fix-it report routed to this person's team: Open, or Acknowledge it
// straight from the queue (which tells the reporter it's been seen).
import { Badge } from '@/components/Badge';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import type { Report } from '@/features/fixit/api';
import { useUpdateReport } from '@/features/fixit/hooks';
import { reportLabel, reportSummary, reportTitle } from '@/features/fixit/logic';
import { reportStatus } from '@/lib/status';
import styles from './QueueCard.module.css';

export function ReportQueueCard({ report }: { report: Report }) {
  const update = useUpdateReport(report.id);
  return (
    <Card className={styles.card}>
      <div className={styles.top}>
        <h3>{reportTitle(report.description)}</h3>
        <StatusBadge map={reportStatus} status={report.status} />
      </div>
      <p className="meta">
        {reportLabel(report)} · {reportSummary(report)}
      </p>
      <p className="meta">
        {report.reporter_name ? `From ${report.reporter_name} · ` : ''}
        {report.vote_count} “me too”
      </p>
      {report.urgent && <Badge tone="attention">Urgent</Badge>}
      <div className={styles.actions}>
        <ButtonLink to={`/reports/${report.id}`} variant="secondary" size="small">
          Open
        </ButtonLink>
        {report.status === 'open' && (
          <Button
            size="small"
            loading={update.isPending}
            onClick={() => update.mutate({ status: 'acknowledged' })}
          >
            Acknowledge
          </Button>
        )}
      </div>
    </Card>
  );
}
