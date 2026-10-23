// Admin > Fix-it reports: every open report, urgent first, whichever team it
// went to. (Staff with a responsibility also see their own team's reports in
// Approvals.) Opening one gives the full staff panel: status, notes, assigning.
import { MotionList } from '@/components/MotionList';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ReportQueueCard } from '@/features/approvals/components/ReportQueueCard';
import { useLiveReports, useOpenReports } from '@/features/fixit/hooks';
import { AdminPage } from '../components/AdminPage';

export function ReportsQueuePage() {
  const reports = useOpenReports();
  useLiveReports();

  return (
    <AdminPage title="Fix-it reports" description="Every open report, urgent first, oldest first.">
      {reports.isPending && <LoadingState />}
      {reports.isError && <ErrorState error={reports.error} onRetry={() => reports.refetch()} />}
      {reports.data?.length === 0 && (
        <EmptyState icon="check" title="No open reports">
          New reports appear here as soon as they're sent.
        </EmptyState>
      )}
      <MotionList items={reports.data} keyOf={(report) => report.id} className="stack-tight">
        {(report) => <ReportQueueCard report={report} />}
      </MotionList>
    </AdminPage>
  );
}
