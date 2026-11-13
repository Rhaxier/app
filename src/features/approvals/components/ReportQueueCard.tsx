// A fix-it report routed to this person's team: Open it, or Acknowledge it
// straight from the queue (which tells the reporter it's been seen).
import { Link } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { Button, ButtonLink } from '@/components/Button';
import type { Report } from '@/features/fixit/api';
import { useUpdateReport } from '@/features/fixit/hooks';
import { reportTitle } from '@/features/fixit/logic';
import { responsibilityLabel } from '@/lib/status';
import { shortWait } from '../logic';
import { QueueRow } from './QueueRow';

interface ReportQueueCardProps {
  report: Report;
  oldest?: boolean;
}

export function ReportQueueCard({ report, oldest }: ReportQueueCardProps) {
  const update = useUpdateReport(report.id);
  return (
    <QueueRow
      type="fixit"
      title={
        <Link to={`/reports/${report.id}`}>
          {report.room_code ? `${report.room_code} · ` : ''}
          {reportTitle(report.description)}
        </Link>
      }
      meta={
        <>
          {report.category_name} · {report.vote_count} “me too”
          {report.urgent && (
            <>
              {' '}
              <Badge tone="fix">Urgent</Badge>
            </>
          )}
        </>
      }
      by={report.reporter_name ?? `${responsibilityLabel[report.routed_to]} queue`}
      waiting={shortWait(report.created_at)}
      oldest={oldest}
      actions={
        <>
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
        </>
      }
    />
  );
}
