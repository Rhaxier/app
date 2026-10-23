// Admin > Audit log: who changed what, newest first. The log is append-only:
// nobody, not even the database owner, can edit or delete it.
import { useState } from 'react';
import { Card } from '@/components/Card';
import { SelectField } from '@/components/Input';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { formatDateTime } from '@/lib/dates';
import { useAuditLog, useUsers } from '../hooks';
import styles from './ListPage.module.css';
import { AdminPage } from '../components/AdminPage';

const tables = [
  'profiles',
  'app_settings',
  'staff_emails',
  'responsibilities',
  'report_category_routes',
  'floors',
  'rooms',
  'venues',
  'collab_posts',
];

export function AuditLogPage() {
  const [table, setTable] = useState('');
  const log = useAuditLog(table || null);
  const users = useUsers();
  const nameOf = (id: string | null) =>
    users.data?.find((user) => user.id === id)?.full_name ?? 'Unknown';

  return (
    <AdminPage title="Audit log" description="The latest 200 changes">
      <SelectField label="Show changes to" value={table} onChange={(e) => setTable(e.target.value)}>
        <option value="">Everything</option>
        {tables.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </SelectField>
      {log.isPending && <LoadingState />}
      {log.isError && <ErrorState error={log.error} onRetry={() => log.refetch()} />}
      {log.data?.length === 0 && <EmptyState icon="layers" title="No changes recorded yet" />}
      <ul className="stack-tight">
        {log.data?.map((entry) => (
          <Card as="li" key={entry.id} className="stack-tight">
            <p>
              <strong>{nameOf(entry.actor_id)}</strong> · {entry.action.replace(/_/g, ' ')} ·{' '}
              {entry.table_name}
            </p>
            <p className="meta">{formatDateTime(entry.created_at)}</p>
            <details>
              <summary className="meta">Details</summary>
              <pre className={styles.mono}>{JSON.stringify(entry.details, null, 2)}</pre>
            </details>
          </Card>
        ))}
      </ul>
    </AdminPage>
  );
}
