// A venue booking waiting on this person, in the staff queue. Two kinds:
//   review     venue staff (and admins) approve or reject a pending request
//   supervise  a student named this teacher as supervisor: confirm or decline
// "Approve" / "Confirm" is the quick path. "Send back" opens the full request
// in a sheet: every detail, a note to the requester, "announce this", and
// both decisions (ReviewActions / SupervisorActions, the same ones My
// bookings uses).
import { useState } from 'react';
import { Button } from '@/components/Button';
import { FormError } from '@/components/Input';
import { Sheet } from '@/components/Sheet';
import type { BookingDetails } from '@/features/venues/api';
import { ReviewActions } from '@/features/venues/components/ReviewActions';
import { SupervisorActions } from '@/features/venues/components/SupervisorActions';
import { useDecideBooking } from '@/features/venues/hooks';
import { formatDate, formatTimeRange } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { shortWait } from '../logic';
import { QueueRow } from './QueueRow';
import styles from './QueueCard.module.css';

interface VenueQueueRowProps {
  booking: BookingDetails;
  mode: 'review' | 'supervise';
  oldest?: boolean;
}

export function VenueQueueRow({ booking, mode, oldest }: VenueQueueRowProps) {
  const decide = useDecideBooking();
  const [open, setOpen] = useState(false);
  const when = `${formatDate(booking.starts_at)}, ${formatTimeRange(booking.starts_at, booking.ends_at)}`;
  const clashes =
    booking.overlaps_pending > 0
      ? `${booking.overlaps_pending} other ${booking.overlaps_pending === 1 ? 'request wants' : 'requests want'} this slot`
      : null;
  const by = [
    booking.requester_name,
    booking.requester_role === 'student' ? 'student' : null,
    mode === 'review' && booking.supervising_teacher_name
      ? `supervisor ${booking.supervising_teacher_name}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <QueueRow
      type="venue"
      title={
        <>
          {booking.venue_name} · {booking.title}
        </>
      }
      meta={
        <>
          {when}
          {mode === 'supervise' && ' · you supervise'}
          {clashes && <span className={styles.warning}> · {clashes}</span>}
        </>
      }
      by={by}
      waiting={shortWait(booking.created_at)}
      oldest={oldest}
      actions={
        <>
          <Button variant="secondary" size="small" onClick={() => setOpen(true)}>
            Send back
          </Button>
          <Button
            size="small"
            disabled={decide.isPending}
            onClick={() =>
              decide.mutate({
                id: booking.id,
                status: mode === 'review' ? 'approved' : 'pending',
                note: '',
                ...(mode === 'review' ? { announce: false } : {}),
              })
            }
          >
            {mode === 'review' ? 'Approve' : 'Confirm'}
          </Button>
        </>
      }
    >
      <FormError message={decide.isError && !open ? errorMessage(decide.error) : null} />
      <Sheet open={open} title={booking.title} onClose={() => setOpen(false)}>
        <div className={styles.details}>
          <p className="meta">
            {booking.venue_name} · {when}
          </p>
          <p className="meta">
            From {by}
            {booking.expected_attendance ? ` · ${booking.expected_attendance} people` : ''}
          </p>
          {booking.purpose && <p className={styles.purpose}>{booking.purpose}</p>}
          {clashes && (
            <p className={`meta ${styles.warning}`}>
              {clashes}. Approving this one rejects {booking.overlaps_pending === 1 ? 'it' : 'them'}
              .
            </p>
          )}
        </div>
        {mode === 'review' ? (
          <ReviewActions booking={booking} />
        ) : (
          <SupervisorActions booking={booking} />
        )}
      </Sheet>
    </QueueRow>
  );
}
