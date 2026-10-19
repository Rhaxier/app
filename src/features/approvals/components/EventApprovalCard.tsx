// A student's volunteering event waiting for a teacher: Open, Send back, Approve.
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError, TextArea } from '@/components/Input';
import { Sheet } from '@/components/Sheet';
import type { VolunteerEvent } from '@/features/volunteering/api';
import { useSetEventStatus } from '@/features/volunteering/hooks';
import { formatDate, formatTimeRange } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import styles from './QueueCard.module.css';

export function EventApprovalCard({ event }: { event: VolunteerEvent }) {
  const setStatus = useSetEventStatus(event.id);
  const [sendingBack, setSendingBack] = useState(false);
  const [note, setNote] = useState('');

  return (
    <Card className={styles.card}>
      <h3>{event.title}</h3>
      <p className="meta">
        By {event.creator?.full_name} · {formatDate(event.starts_at)},{' '}
        {formatTimeRange(event.starts_at, event.ends_at)}
      </p>
      <p className="meta">
        {event.roles.length} {event.roles.length === 1 ? 'role' : 'roles'} · {event.supw_hours} SUPW
        hours
      </p>
      <FormError
        message={setStatus.isError && !sendingBack ? errorMessage(setStatus.error) : null}
      />
      <div className={styles.actions}>
        <ButtonLink to={`/volunteer/${event.id}`} variant="ghost" size="small">
          Open
        </ButtonLink>
        <Button variant="secondary" size="small" onClick={() => setSendingBack(true)}>
          Send back
        </Button>
        <Button
          size="small"
          loading={setStatus.isPending && !sendingBack}
          onClick={() => setStatus.mutate({ status: 'published' })}
        >
          Approve
        </Button>
      </div>
      <Sheet
        open={sendingBack}
        title={`Send back: ${event.title}`}
        onClose={() => setSendingBack(false)}
      >
        <TextArea
          label="What needs to change?"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <FormError message={setStatus.isError ? errorMessage(setStatus.error) : null} />
        <Button
          fullWidth
          disabled={!note.trim()}
          loading={setStatus.isPending}
          onClick={() =>
            setStatus.mutate(
              { status: 'sent_back', note: note.trim() },
              { onSuccess: () => setSendingBack(false) },
            )
          }
        >
          Send back
        </Button>
      </Sheet>
    </Card>
  );
}
