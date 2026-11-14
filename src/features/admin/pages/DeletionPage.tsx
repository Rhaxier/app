// Admin > System > Data deletion. For a request to delete someone's data:
// their name and email are replaced, the photos and files they uploaded are
// removed, their settings and notifications go, and they can't sign in again.
// What they did stays, under "Deleted user": SUPW hours totals, reports,
// posts and bookings. It needs their email typed in full, and is audited
// (without their name or email).
import { useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TextField } from '@/components/Input';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { errorMessage } from '@/lib/errors';
import { roleLabel } from '@/lib/status';
import type { AdminUser } from '../api';
import { AdminPage } from '../components/AdminPage';
import { footnotes, pageIntros } from '../strings';
import { useAnonymiseUser, useUsers } from '../hooks';
import styles from './ListPage.module.css';

export function DeletionPage() {
  const users = useUsers();
  const anonymise = useAnonymiseUser();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<AdminUser | null>(null);

  const q = query.trim().toLowerCase();
  const matches =
    q.length < 2
      ? []
      : (users.data ?? []).filter(
          (u) =>
            !u.full_name.startsWith('Deleted user') &&
            (u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
        );

  return (
    <AdminPage title="Data deletion" description={pageIntros.deletion}>
      <Card className="stack-tight">
        <h2 className={styles.cardTitle}>What happens</h2>
        <ul className="stack-tight">
          {footnotes.deletion.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <p className="meta">{footnotes.deletion.auditNote}</p>
      </Card>

      <TextField
        label="Find the person (name or email)"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {users.isPending && <LoadingState shape="row" />}
      {users.isError && <ErrorState error={users.error} onRetry={() => users.refetch()} />}
      {q.length >= 2 && users.data && matches.length === 0 && (
        <EmptyState icon="users" title="No one matches" />
      )}
      <ul className="stack-tight">
        {matches.slice(0, 20).map((user) => (
          <Card as="li" key={user.id} className={styles.row}>
            <span className={styles.rowButton}>
              <span className={styles.rowTitle}>{user.full_name}</span>
              <span className="meta">{user.email}</span>
            </span>
            <Badge tone="quiet">{roleLabel[user.role]}</Badge>
            <Button size="small" variant="alert" onClick={() => setChosen(user)}>
              Delete data…
            </Button>
          </Card>
        ))}
      </ul>

      <ConfirmDialog
        open={chosen !== null}
        title={`Delete ${chosen?.full_name ?? ''}'s personal data?`}
        confirmLabel="Delete their data"
        typeToConfirm={chosen?.email}
        busy={anonymise.isPending}
        error={anonymise.isError ? errorMessage(anonymise.error) : null}
        onClose={() => setChosen(null)}
        onConfirm={() =>
          chosen &&
          anonymise.mutate(
            { userId: chosen.id, confirm: chosen.email },
            { onSuccess: () => setChosen(null) },
          )
        }
      >
        <p>
          This can't be undone. Their records stay under “Deleted user”; everything that identifies
          them goes.
        </p>
      </ConfirmDialog>
    </AdminPage>
  );
}
