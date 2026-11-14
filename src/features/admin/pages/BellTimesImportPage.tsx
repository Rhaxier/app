// Admin > School calendar > Upload bell times. The whole timetable from a
// CSV file instead of entering periods one by one. Three steps:
//   1. Download the template: it holds today's periods, so it's easy to edit.
//   2. Choose the file. The database checks every line without saving
//      anything: unknown weekdays, bad times, periods that end before they
//      start, overlaps and duplicate orders on the same day.
//   3. Import, once there are no problems. Every weekday in the file gets
//      exactly the periods in the file; other weekdays keep theirs. It all
//      happens in one transaction, and the audit log records it.
// See admin_import_periods() in supabase/migrations/20261027120000_period_import.sql.
import { useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError } from '@/components/Input';
import type { PeriodCsvRow, PeriodImportResult } from '@/features/school/api';
import { useImportPeriods, usePeriodImportPreview, usePeriods } from '@/features/school/hooks';
import {
  importedWeekdays,
  PERIOD_CSV_COLUMNS,
  periodRowsFromCsv,
  periodTemplateRows,
} from '@/features/school/logic';
import { downloadCsv, toCsv } from '@/lib/csv';
import { errorMessage } from '@/lib/errors';
import { AdminPage } from '../components/AdminPage';
import { footnotes, pageIntros } from '../strings';
import { PeriodImportPreview } from '../components/PeriodImportPreview';

function templateCsv(rows: PeriodCsvRow[]): string {
  return toCsv(
    rows,
    PERIOD_CSV_COLUMNS.map((column) => ({
      header: column,
      value: (row: PeriodCsvRow) => row[column],
    })),
  );
}

export function BellTimesImportPage() {
  const periods = usePeriods();
  const preview = usePeriodImportPreview();
  const save = useImportPeriods();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<PeriodCsvRow[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<PeriodImportResult[] | null>(null);

  const problems = preview.data?.filter((r) => r.outcome === 'error').length ?? 0;

  async function choose(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setDone(null);
    preview.reset();
    save.reset();
    const parsed = periodRowsFromCsv(await file.text());
    if ('problem' in parsed) {
      setProblem(parsed.problem);
      setRows([]);
      return;
    }
    setProblem(null);
    setRows(parsed.rows);
    preview.mutate(parsed.rows);
  }

  return (
    <AdminPage title="Upload bell times" description={pageIntros['bell-times']}>
      <Card className="stack-tight">
        <h3>1. Download the template</h3>
        <p className="meta">{footnotes.bellTimes.template(PERIOD_CSV_COLUMNS.join(', '))}</p>
        <Button
          variant="secondary"
          icon="download"
          disabled={!periods.data}
          onClick={() =>
            downloadCsv('bell-times.csv', templateCsv(periodTemplateRows(periods.data ?? [])))
          }
        >
          Download the template
        </Button>
      </Card>

      <Card className="stack-tight">
        <h3>2. Choose the file</h3>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="visually-hidden"
          aria-label="CSV file"
          onChange={(e) => choose(e.target.files?.[0])}
        />
        <Button icon="paperclip" onClick={() => fileInput.current?.click()}>
          {fileName ? `Choose another file (${fileName})` : 'Choose a CSV file'}
        </Button>
        <FormError message={problem ?? (preview.isError ? errorMessage(preview.error) : null)} />
        {preview.isPending && <p className="meta">Checking every line…</p>}
      </Card>

      {preview.data && !done && (
        <section className="stack-tight" aria-label="Preview">
          <h2>3. Check, then import</h2>
          <PeriodImportPreview results={preview.data} />
          <FormError message={save.isError ? errorMessage(save.error) : null} />
          <Button
            fullWidth
            disabled={problems > 0}
            loading={save.isPending}
            onClick={() => save.mutate(rows, { onSuccess: setDone })}
          >
            {problems > 0
              ? `Fix ${problems} ${problems === 1 ? 'problem' : 'problems'} in the file first`
              : `Replace the periods for ${importedWeekdays(preview.data)}`}
          </Button>
        </section>
      )}

      {done && (
        <Card className="stack-tight" aria-live="polite">
          <h3>Imported</h3>
          <p>New periods for {importedWeekdays(done)}. Bookings from now on follow them.</p>
          <p className="meta">{footnotes.bellTimes.after}</p>
          <div className="row-wrap">
            <ButtonLink to="/bell-times" variant="secondary">
              See the bell times
            </ButtonLink>
            <ButtonLink to="/admin/school-week" variant="quiet">
              Back to periods
            </ButtonLink>
          </div>
        </Card>
      )}
    </AdminPage>
  );
}
