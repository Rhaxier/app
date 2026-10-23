// The import preview: what will happen to each row of the CSV file, as the
// database worked it out (a dry run). Rows with a problem say what's wrong
// and won't be imported; the rest will be.
import { Badge } from '@/components/Badge';
import type { ImportResult } from '../api';
import { importSummary } from '../logic';
import styles from './ImportPreview.module.css';

const outcomeLook: Record<
  ImportResult['outcome'],
  { label: string; tone: 'good' | 'attention' | 'quiet' }
> = {
  create: { label: 'New', tone: 'good' },
  update: { label: 'Update', tone: 'quiet' },
  error: { label: 'Problem', tone: 'attention' },
};

export function ImportPreview({ results }: { results: ImportResult[] }) {
  return (
    <div className="stack-tight">
      <p className="meta" aria-live="polite">
        {results.length} rows: {importSummary(results)}
      </p>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="visually-hidden">Import preview</caption>
          <thead>
            <tr>
              <th scope="col">Row</th>
              <th scope="col">Person</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => {
              const look = outcomeLook[result.outcome];
              return (
                <tr
                  key={result.row_number}
                  className={result.outcome === 'error' ? styles.error : undefined}
                >
                  {/* Row 1 of the data is line 2 of the file (line 1 is the headings). */}
                  <td>{result.row_number + 1}</td>
                  <td>
                    <span className={styles.name}>{result.full_name || '(no name)'}</span>
                    <span className="meta">{result.email || '(no email)'}</span>
                  </td>
                  <td>
                    <Badge tone={look.tone}>{look.label}</Badge>
                    <span className={styles.message}>{result.message}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
