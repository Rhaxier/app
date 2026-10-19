// "Export SUPW hours": downloads every student's confirmed hours as a CSV
// file. The database only lets admins and the SUPW coordinator run it.
import { Button } from '@/components/Button';
import { FormError } from '@/components/Input';
import { useSupwHoursReport } from '@/features/volunteering/hooks';
import { downloadCsv, toCsv } from '@/lib/csv';
import { dayKey } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';

export function SupwExportButton() {
  const report = useSupwHoursReport();

  function exportCsv() {
    report.mutate(undefined, {
      onSuccess: (rows) => {
        const csv = toCsv(rows, [
          { header: 'Name', value: (r) => r.full_name },
          { header: 'Email', value: (r) => r.email },
          { header: 'Grade', value: (r) => r.grade },
          { header: 'Section', value: (r) => r.section },
          { header: 'Events attended', value: (r) => r.events_attended },
          { header: 'SUPW hours confirmed', value: (r) => r.hours_confirmed },
        ]);
        downloadCsv(`supw-hours-${dayKey()}.csv`, csv);
      },
    });
  }

  return (
    <>
      <Button variant="secondary" icon="download" loading={report.isPending} onClick={exportCsv}>
        Export SUPW hours (CSV)
      </Button>
      <FormError message={report.isError ? errorMessage(report.error) : null} />
    </>
  );
}
