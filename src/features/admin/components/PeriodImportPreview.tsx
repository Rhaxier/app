// The bell times preview: every line of the uploaded file, as the database
// read it (a dry run). Lines with a problem say what's wrong; while there is
// one, nothing can be imported.
import { Badge } from '@/components/Badge';
import type { PeriodImportResult } from '@/features/school/api';
import styles from './ImportPreview.module.css';

export function PeriodImportPreview({ results }: { results: PeriodImportResult[] }) {
  const problems = results.filter((r) => r.outcome === 'error').length;
  return (
    <div className="stack-tight">
      <p className="meta" aria-live="polite">
        {results.length} {results.length === 1 ? 'line' : 'lines'}:{' '}
        {problems === 0
          ? 'no problems'
          : `${problems} with ${problems === 1 ? 'a problem' : 'problems'}`}
      </p>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Line</th>
              <th scope="col">Period</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr
                key={result.line}
                className={result.outcome === 'error' ? styles.error : undefined}
              >
                <td>{result.line}</td>
                <td>
                  <span className={styles.name}>
                    {result.weekday || '(no weekday)'} · {result.period_name || '(no name)'}
                  </span>
                  <span className="meta">
                    <span className={styles.nowrap}>
                      {result.start_time || '?'}–{result.end_time || '?'}
                    </span>{' '}
                    · order {result.sort_order || '?'}
                  </span>
                </td>
                <td>
                  <Badge tone={result.outcome === 'error' ? 'attention' : 'good'}>
                    {result.outcome === 'error' ? 'Problem' : 'OK'}
                  </Badge>
                  {result.message && <span className={styles.message}>{result.message}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
