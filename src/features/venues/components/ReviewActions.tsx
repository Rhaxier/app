// Approve or reject a pending request, for venue staff (Approvals queue).
// "Announce this" posts the approved booking to the announcements feed.
import { useState } from 'react';
import { Button } from '@/components/Button';
import { CheckboxField, FormError, TextField } from '@/components/Input';
import { errorMessage } from '@/lib/errors';
import type { BookingDetails } from '../api';
import { useDecideBooking } from '../hooks';
import styles from './ReviewActions.module.css';

export function ReviewActions({ booking }: { booking: BookingDetails }) {
  const decide = useDecideBooking();
  const [note, setNote] = useState('');
  const [announce, setAnnounce] = useState(false);
  return (
    <div className="stack-tight">
      <TextField
        label="Note to the requester (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <CheckboxField
        label="Announce this to the school"
        checked={announce}
        onChange={(e) => setAnnounce(e.target.checked)}
      />
      <FormError message={decide.isError ? errorMessage(decide.error) : null} />
      <div className={styles.buttons}>
        <Button
          variant="secondary"
          size="small"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ id: booking.id, status: 'rejected', note })}
        >
          Reject
        </Button>
        <Button
          size="small"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ id: booking.id, status: 'approved', note, announce })}
        >
          Approve
        </Button>
      </div>
    </div>
  );
}
