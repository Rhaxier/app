// Admin > System > Audit log: who changed what, newest first, filtered in the
// database by person, action, table and dates. The log is append-only:
// nobody, not even the database owner, can edit or delete it.
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SelectField, TextField } from '@/components/Input';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { formatDateTime } from '@/lib/dates';
import type { AuditFilters } from '../api';
import { AdminPage } from '../components/AdminPage';
import { useAuditFilterChoices, useAuditLog, useUsers } from '../hooks';
import styles from './ListPage.module.css';

const noFilters: AuditFilters = { actorId: '', action: '', table: '', from: '', to: '' };

/** "role_changed" → "role changed". */
const words = (value: string) => value.replace(/_/g, ' ');

export function AuditLogPage() {
  const [filters, setFilters] = useState<AuditFilters>(noFilters);
  const log = useAuditLog(filters);
  const choices = useAuditFilterChoices();
  const users = useUsers();
  const staff = (users.data ?? []).filter((user) => user.role !== 'student');
  const nameOf = (id: string | null) =>
    id ? (users.data?.find((user) => user.id === id)?.full_name ?? 'Someone') : 'The system';
  const set = (changes: Partial<AuditFilters>) => setFilters((f) => ({ ...f, ...changes }));

  return (
    <AdminPage title="Audit log" description="Who changed what. Shows the latest 200 matches.">
      <Card className={styles.filters}>
        <SelectField
          label="Person"
          value={filters.actorId}
          onChange={(e) => set({ actorId: e.target.value })}
        >
          <option value="">Anyone</option>
          {staff.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Action"
          value={filters.action}
          onChange={(e) => set({ action: e.target.value })}
        >
          <option value="">Any action</option>
          {choices.data?.actions.map((action) => (
            <option key={action} value={action}>
              {words(action)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Table"
          value={filters.table}
          onChange={(e) => set({ table: e.target.value })}
        >
          <option value="">Any table</option>
          {choices.data?.tables.map((table) => (
            <option key={table} value={table}>
              {table}
            </option>
          ))}
        </SelectField>
        <TextField
          label="From"
          type="date"
          value={filters.from}
          onChange={(e) => set({ from: e.target.value })}
        />
        <TextField
          label="To"
          type="date"
          value={filters.to}
          onChange={(e) => set({ to: e.target.value })}
        />
        <Button variant="ghost" onClick={() => setFilters(noFilters)}>
          Clear filters
        </Button>
      </Card>

      {log.isPending && <LoadingState shape="row" count={5} />}
      {log.isError && <ErrorState error={log.error} onRetry={() => log.refetch()} />}
      {log.data?.length === 0 && <EmptyState icon="layers" title="Nothing matches" />}
      <ul className="stack-tight">
        {log.data?.map((entry) => (
          <Card as="li" key={entry.id} className="stack-tight">
            <p>
              <strong>{nameOf(entry.actor_id)}</strong> · {words(entry.action)} · {entry.table_name}
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
