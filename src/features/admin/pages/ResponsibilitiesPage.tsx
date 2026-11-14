// Admin > Responsibilities (Q1). Who handles facilities and IT reports, who
// approves venue bookings, who coordinates SUPW. Only staff can hold one.
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { FormError, SelectField } from '@/components/Input';
import { ErrorState, LoadingState } from '@/components/States';
import { errorMessage } from '@/lib/errors';
import { responsibilityLabel } from '@/lib/status';
import { Constants } from '@/types/database';
import type { AdminUser, Responsibility } from '../api';
import { useToggleResponsibility, useUsers } from '../hooks';
import styles from './ListPage.module.css';
import { AdminPage } from '../components/AdminPage';
import { footnotes, pageIntros } from '../strings';

const kinds = Constants.public.Enums.responsibility_kind as readonly Responsibility[];

const explanations: Record<Responsibility, string> = footnotes.responsibilities;

export function ResponsibilitiesPage() {
  const users = useUsers();
  const toggle = useToggleResponsibility();

  return (
    <AdminPage title="Responsibilities" description={pageIntros.responsibilities}>
      {users.isPending && <LoadingState />}
      {users.isError && <ErrorState error={users.error} onRetry={() => users.refetch()} />}
      <FormError message={toggle.isError ? errorMessage(toggle.error) : null} />
      {users.data &&
        kinds.map((kind) => (
          <KindCard
            key={kind}
            kind={kind}
            users={users.data}
            busy={toggle.isPending}
            onToggle={(userId, holds) => toggle.mutate({ userId, kind, holds })}
          />
        ))}
    </AdminPage>
  );
}

interface KindCardProps {
  kind: Responsibility;
  users: AdminUser[];
  busy: boolean;
  onToggle: (userId: string, holds: boolean) => void;
}

function KindCard({ kind, users, busy, onToggle }: KindCardProps) {
  const [adding, setAdding] = useState('');
  const holders = users.filter((user) => user.responsibilities.includes(kind));
  const candidates = users.filter(
    (user) => user.role !== 'student' && !user.responsibilities.includes(kind),
  );

  return (
    <Card as="section" className="stack-tight" aria-label={responsibilityLabel[kind]}>
      <h2 className={styles.cardTitle}>{responsibilityLabel[kind]}</h2>
      <p className="meta">{explanations[kind]}</p>
      {holders.length === 0 && <p className={styles.warning}>Nobody holds this yet.</p>}
      <ul>
        {holders.map((user) => (
          <li key={user.id} className={styles.row}>
            <span>{user.full_name}</span>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove ${user.full_name}`}
              disabled={busy}
              onClick={() => onToggle(user.id, true)}
            >
              <Icon name="close" size={18} />
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.addRow}>
        <SelectField label="Add someone" value={adding} onChange={(e) => setAdding(e.target.value)}>
          <option value="">Choose a teacher or admin…</option>
          {candidates.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name}
            </option>
          ))}
        </SelectField>
        <Button
          variant="secondary"
          disabled={!adding || busy}
          onClick={() => {
            onToggle(adding, false);
            setAdding('');
          }}
        >
          Add
        </Button>
      </div>
    </Card>
  );
}
