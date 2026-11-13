// An attended sign-up waiting for this teacher to confirm SUPW hours. The
// suggested hours (the event's) can be changed before confirming.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { FormError } from '@/components/Input';
import type { HoursToConfirm } from '@/features/volunteering/api';
import { useUpdateSignup } from '@/features/volunteering/hooks';
import { formatDate } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { shortWait } from '../logic';
import { QueueRow } from './QueueRow';
import styles from './QueueCard.module.css';

interface HoursCardProps {
  item: HoursToConfirm;
  oldest?: boolean;
}

export function HoursCard({ item, oldest }: HoursCardProps) {
  const update = useUpdateSignup();
  const [hours, setHours] = useState(String(item.suggested_hours));
  const inputId = `hours-${item.signup_id}`;
  return (
    <QueueRow
      type="hours"
      title={
        <Link to={`/volunteer/${item.event_id}`}>
          {item.event_title} · {item.role_name}
        </Link>
      }
      meta={formatDate(item.event_starts_at)}
      by={item.grade ? `${item.full_name} · Gr ${item.grade}` : item.full_name}
      waiting={shortWait(item.event_starts_at)}
      oldest={oldest}
      actions={
        <>
          <label htmlFor={inputId} className="visually-hidden">
            SUPW hours for {item.full_name}
          </label>
          <input
            id={inputId}
            className={styles.hours}
            type="number"
            min={0}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
          <Button
            size="small"
            disabled={hours === '' || Number(hours) < 0}
            loading={update.isPending}
            onClick={() =>
              update.mutate({
                signupId: item.signup_id,
                changes: { hours_confirmed: Number(hours) },
              })
            }
          >
            Confirm
          </Button>
        </>
      }
    >
      <FormError message={update.isError ? errorMessage(update.error) : null} />
    </QueueRow>
  );
}
