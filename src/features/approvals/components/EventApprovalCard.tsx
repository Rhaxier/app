// A student's volunteering event waiting for a teacher: Send back (with a
// note, in a sheet) or Approve. The title opens the event.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { FormError, TextArea } from '@/components/Input';
import { Sheet } from '@/components/Sheet';
import type { VolunteerEvent } from '@/features/volunteering/api';
import { useSetEventStatus } from '@/features/volunteering/hooks';
import { formatDate, formatTimeRange } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { shortWait } from '../logic';
import { QueueRow } from './QueueRow';

interface EventApprovalCardProps {
  event: VolunteerEvent;
  oldest?: boolean;
}

export function EventApprovalCard({ event, oldest }: EventApprovalCardProps) {
  const setStatus = useSetEventStatus(event.id);
  const [sendingBack, setSendingBack] = useState(false);
  const [note, setNote] = useState('');
  const spots = event.roles.reduce((total, role) => total + role.spots_wanted, 0);

  return (
    <QueueRow
      type="event"
      title={<Link to={`/volunteer/${event.id}`}>{event.title}</Link>}
      meta={
        <>
          {formatDate(event.starts_at)}, {formatTimeRange(event.starts_at, event.ends_at)} ·{' '}
          {event.roles.length} {event.roles.length === 1 ? 'role' : 'roles'}, {spots}{' '}
          {spots === 1 ? 'spot' : 'spots'} · {event.supw_hours} SUPW hours
        </>
      }
      by={event.creator?.full_name}
      waiting={shortWait(event.created_at)}
      oldest={oldest}
      actions={
        <>
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
        </>
      }
    >
      <FormError
        message={setStatus.isError && !sendingBack ? errorMessage(setStatus.error) : null}
      />
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
    </QueueRow>
  );
}
