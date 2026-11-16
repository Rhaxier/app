// Export the chosen term's room names as CSV, or import a CSV file into it.
//
// An import is checked in the browser first (checkAssignmentsCsv) and shown
// as a preview: how many rooms get a name, change, or lose their name, then
// every problem with its row. Nothing is saved until Apply, and a file with
// any problem can't be applied. The database repeats the same checks.
import { useRef, useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError } from '@/components/Input';
import {
  assignmentsToCsv,
  checkAssignmentsCsv,
  compareAssignments,
  type AssignmentsCheck,
} from '@/features/map/nav/assignments';
import { useImportAssignments } from '@/features/map/nav/hooks';
import type { Assignment, Geometry } from '@/features/map/nav/types';
import { downloadCsv } from '@/lib/csv';
import { errorMessage } from '@/lib/errors';
import { footnotes } from '../../strings';
import styles from './MapRooms.module.css';

interface AssignmentCsvProps {
  geometry: Geometry;
  presetId: string;
  presetName: string;
  assignments: Assignment[];
}

export function AssignmentCsv({ geometry, presetId, presetName, assignments }: AssignmentCsvProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ fileName: string; check: AssignmentsCheck } | null>(
    null,
  );
  const apply = useImportAssignments();

  async function readFile(file: File) {
    const text = await file.text();
    apply.reset();
    setPreview({ fileName: file.name, check: checkAssignmentsCsv(text, geometry) });
  }

  return (
    <section className="stack-tight" aria-label="Import and export">
      <div className="row-wrap">
        <Button
          variant="secondary"
          size="small"
          icon="download"
          onClick={() =>
            downloadCsv(`room-names-${slug(presetName)}.csv`, assignmentsToCsv(assignments))
          }
        >
          Export CSV
        </Button>
        <Button
          variant="secondary"
          size="small"
          icon="paperclip"
          onClick={() => fileInput.current?.click()}
        >
          Import CSV
        </Button>
        <input
          ref={fileInput}
          className={styles.fileInput}
          type="file"
          accept=".csv,text/csv"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = ''; // so choosing the same file again still works
            if (file) void readFile(file);
          }}
        />
      </div>
      <p className="meta">{footnotes.mapRooms.import}</p>

      {preview && (
        <ImportPreview
          fileName={preview.fileName}
          check={preview.check}
          current={assignments}
          presetName={presetName}
          applying={apply.isPending}
          error={apply.isError ? errorMessage(apply.error) : null}
          onApply={() =>
            apply.mutate(
              {
                presetId,
                assignments: preview.check.assignments,
                rows: preview.check.lines,
              },
              { onSuccess: () => setPreview(null) },
            )
          }
          onCancel={() => setPreview(null)}
        />
      )}
    </section>
  );
}

interface ImportPreviewProps {
  fileName: string;
  check: AssignmentsCheck;
  current: Assignment[];
  presetName: string;
  applying: boolean;
  error: string | null;
  onApply: () => void;
  onCancel: () => void;
}

export function ImportPreview({
  fileName,
  check,
  current,
  presetName,
  applying,
  error,
  onApply,
  onCancel,
}: ImportPreviewProps) {
  const changes = compareAssignments(current, check.assignments);
  const blocked = check.errors.length > 0;
  return (
    <Card className="stack-tight" aria-label="Import preview">
      <p>
        <strong>{fileName}</strong> into {presetName}
      </p>
      <div className={styles.counts} aria-live="polite">
        <Badge tone="good">{changes.added.length} get a name</Badge>
        <Badge tone="quiet">{changes.changed.length} change</Badge>
        <Badge tone={changes.removed.length > 0 ? 'attention' : 'quiet'}>
          {changes.removed.length} lose their name
        </Badge>
        {blocked && (
          <Badge tone="fix">
            {check.errors.length} {check.errors.length === 1 ? 'problem' : 'problems'}
          </Badge>
        )}
      </div>
      {blocked && (
        <>
          <p className="meta">Fix these in the file and import it again. Nothing has been saved.</p>
          <ul className={styles.errors}>
            {check.errors.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </>
      )}
      <FormError message={error} />
      <div className="row">
        <Button onClick={onApply} disabled={blocked} loading={applying}>
          Apply
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'term';
