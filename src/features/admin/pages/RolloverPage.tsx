// Admin > Year-end rollover. Moves every student up to the next grade and
// archives the top grade (they've left: history kept, sign-in removed).
// The preview is a dry run of the same database function, so what you see is
// exactly what will happen. Running it needs the year typed in full.
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState, LoadingState } from '@/components/States';
import { dayKey } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import type { RolloverStep } from '../api';
import { AdminPage } from '../components/AdminPage';
import { useRollover, useRolloverPreview } from '../hooks';
import styles from './ListPage.module.css';

function describe(step: RolloverStep): string {
  const who = `${step.students} ${step.students === 1 ? 'student' : 'students'}`;
  return step.to_grade === null
    ? `Grade ${step.from_grade} leaves the school (archived): ${who}`
    : `Grade ${step.from_grade} → Grade ${step.to_grade}: ${who}`;
}

export function RolloverPage() {
  const preview = useRolloverPreview();
  const run = useRollover();
  const [confirming, setConfirming] = useState(false);
  // The database expects the current year in Dubai.
  const phrase = `ROLLOVER ${dayKey().slice(0, 4)}`;

  return (
    <AdminPage
      title="Year-end rollover"
      description="Move every student up a grade at the end of the school year."
    >
      <Card className="stack-tight">
        <h3>What will happen</h3>
        {preview.isPending && <LoadingState shape="row" count={3} />}
        {preview.isError && <ErrorState error={preview.error} onRetry={() => preview.refetch()} />}
        {preview.data?.length === 0 && <p className="meta">There are no students to move.</p>}
        {preview.data && preview.data.length > 0 && (
          <ul>
            {preview.data.map((step) => (
              <li key={step.from_grade} className={styles.row}>
                {describe(step)}
              </li>
            ))}
          </ul>
        )}
        <p className="meta">
          Archived students keep their history (SUPW hours, reports, projects) but can no longer
          sign in. Sections stay the same (10 A becomes 11 A). Class lists are not changed: set up
          next year's classes afterwards.
        </p>
      </Card>

      {run.data ? (
        <Card className="stack-tight" aria-live="polite">
          <h3>Done</h3>
          <ul>
            {run.data.map((step) => (
              <li key={step.from_grade}>{describe(step)}</li>
            ))}
          </ul>
          <p className="meta">The rollover is recorded in the audit log.</p>
        </Card>
      ) : (
        <Button
          variant="alert"
          fullWidth
          disabled={!preview.data || preview.data.length === 0}
          onClick={() => setConfirming(true)}
        >
          Run the year-end rollover…
        </Button>
      )}

      <ConfirmDialog
        open={confirming}
        title="Run the year-end rollover?"
        confirmLabel="Run the rollover"
        typeToConfirm={phrase}
        busy={run.isPending}
        error={run.isError ? errorMessage(run.error) : null}
        onClose={() => setConfirming(false)}
        onConfirm={() => run.mutate(phrase, { onSuccess: () => setConfirming(false) })}
      >
        <p>
          Every student moves up a grade and the top grade is archived. This can't be undone from
          the app.
        </p>
      </ConfirmDialog>
    </AdminPage>
  );
}
