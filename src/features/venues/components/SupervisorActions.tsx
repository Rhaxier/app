// Confirm or decline a student's request as their supervising teacher.
// Used on My bookings and in the Approvals queue.
import { useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, TextField } from '@/components/Input';
import { errorMessage } from '@/lib/errors';
import type { BookingDetails } from '../api';
import { useDecideBooking } from '../hooks';
import styles from './ReviewActions.module.css';

export function SupervisorActions({ booking }: { booking: BookingDetails }) {
  const decide = useDecideBooking();
  const [note, setNote] = useState('');
  return (
    <div className="stack-tight">
      <TextField
        label="Note to the student (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <FormError message={decide.isError ? errorMessage(decide.error) : null} />
      <div className={styles.buttons}>
        <Button
          variant="secondary"
          size="small"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ id: booking.id, status: 'rejected', note })}
        >
          Decline
        </Button>
        <Button
          size="small"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ id: booking.id, status: 'pending', note })}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}
