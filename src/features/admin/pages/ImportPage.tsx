// Admin > Import people. Three steps:
//   1. Choose a CSV file (download the template to see the columns).
//   2. Preview: the database checks every row (bad email domain, unknown grade
//      or section, duplicates…) without saving anything.
//   3. Import: the good rows are saved in one go; rows with problems are skipped.
// New people are set up the first time they sign in; existing accounts are
// updated straight away. See admin_import_people() in the people migration.
import { useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError } from '@/components/Input';
import { useAppSettings } from '@/features/settings/hooks';
import { downloadCsv, toCsv } from '@/lib/csv';
import { errorMessage } from '@/lib/errors';
import type { ImportResult, ImportRow } from '../api';
import { AdminPage } from '../components/AdminPage';
import { ImportPreview } from '../components/ImportPreview';
import { useImportPeople, useImportPreview } from '../hooks';
import { IMPORT_COLUMNS, importSummary, rowsFromCsv } from '../logic';

/** The file people fill in: the headings plus two clearly fake examples. */
function downloadTemplate(domain: string) {
  const examples: ImportRow[] = [
    {
      name: 'Student Example (sample)',
      email: `student.example@${domain}`,
      role: 'student',
      grade: '10',
      section: 'A',
    },
    {
      name: 'Teacher Example (sample)',
      email: `teacher.example@${domain}`,
      role: 'teacher',
      grade: '',
      section: '',
    },
  ];
  downloadCsv(
    'people-import-template.csv',
    toCsv(
      examples,
      IMPORT_COLUMNS.map((column) => ({ header: column, value: (row: ImportRow) => row[column] })),
    ),
  );
}

export function ImportPage() {
  const settings = useAppSettings();
  const preview = useImportPreview();
  const save = useImportPeople();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<ImportResult[] | null>(null);

  const domain = settings.data?.school_email_domain ?? 'school.example';
  const ready = preview.data?.filter((r) => r.outcome !== 'error').length ?? 0;

  async function choose(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setDone(null);
    preview.reset();
    const parsed = rowsFromCsv(await file.text());
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
    <AdminPage
      title="Import people"
      description="Add or update students and staff from a CSV file."
    >
      <Card className="stack-tight">
        <h3>1. Fill in the template</h3>
        <p className="meta">
          One person per line: name, email, role (student or teacher), grade and section (for
          students). Admins are made one at a time on the Users screen.
        </p>
        <Button variant="secondary" icon="download" onClick={() => downloadTemplate(domain)}>
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
        {preview.isPending && <p className="meta">Checking every row…</p>}
      </Card>

      {preview.data && !done && (
        <section className="stack-tight" aria-label="Preview">
          <h2>3. Check, then import</h2>
          <ImportPreview results={preview.data} />
          <FormError message={save.isError ? errorMessage(save.error) : null} />
          <Button
            fullWidth
            disabled={ready === 0}
            loading={save.isPending}
            onClick={() => save.mutate(rows, { onSuccess: setDone })}
          >
            {ready === 0
              ? 'Nothing to import'
              : `Import ${ready} ${ready === 1 ? 'person' : 'people'} (skip the problems)`}
          </Button>
        </section>
      )}

      {done && (
        <Card className="stack-tight" aria-live="polite">
          <h3>Imported</h3>
          <p>{importSummary(done)}.</p>
          <p className="meta">
            New people are set up the first time they sign in. Fix any problem rows in the file and
            import it again: rows already done are simply updated.
          </p>
          <ImportPreview results={done} />
        </Card>
      )}
    </AdminPage>
  );
}
