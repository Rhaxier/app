// Admin > Outbox: emails and phone pushes the app has queued. Nothing is sent
// yet (docs/OPEN_QUESTIONS.md, Q7 and Q8); this shows what would be.
import { useState } from 'react';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { relativeTime } from '@/lib/dates';
import { useOutbox } from '../hooks';
import { AdminPage } from '../components/AdminPage';

type OutboxTable = 'email_outbox' | 'push_outbox';

export function OutboxPage() {
  const [table, setTable] = useState<OutboxTable>('email_outbox');
  const rows = useOutbox(table);
  return (
    <AdminPage
      title="Outbox"
      description="Queued, not sent: no email or push provider is set up yet."
    >
      <SegmentedControl
        label="Outbox"
        value={table}
        onChange={setTable}
        options={[
          { value: 'email_outbox', label: 'Email' },
          { value: 'push_outbox', label: 'Push' },
        ]}
      />
      {rows.isPending && <LoadingState />}
      {rows.isError && <ErrorState error={rows.error} onRetry={() => rows.refetch()} />}
      {rows.data?.length === 0 && <EmptyState icon="bell" title="Nothing queued" />}
      <ul className="stack-tight">
        {rows.data?.map((row) => {
          const payload = row.payload as { title?: string; body?: string };
          return (
            <Card as="li" key={row.id} className="stack-tight">
              <div className="row-wrap">
                <Badge tone={row.kind === 'immediate' ? 'attention' : 'quiet'}>
                  {row.kind === 'immediate' ? 'Immediate' : 'Daily digest'}
                </Badge>
                <Badge tone="quiet">{row.status}</Badge>
              </div>
              <p>
                <strong>{row.recipient?.full_name}</strong>: {payload.title}
              </p>
              <p className="meta">{relativeTime(row.created_at)}</p>
            </Card>
          );
        })}
      </ul>
    </AdminPage>
  );
}
