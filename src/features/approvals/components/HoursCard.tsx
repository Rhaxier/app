// An attended sign-up waiting for this teacher to confirm SUPW hours.
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError } from '@/components/Input';
import type { HoursToConfirm } from '@/features/volunteering/api';
import { useUpdateSignup } from '@/features/volunteering/hooks';
import { formatDate } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import styles from './QueueCard.module.css';

export function HoursCard({ item }: { item: HoursToConfirm }) {
  const update = useUpdateSignup();
  const [hours, setHours] = useState(String(item.suggested_hours));
  const inputId = `hours-${item.signup_id}`;
  return (
    <Card className={styles.card}>
      <h3>{item.full_name}</h3>
      <p className="meta">
        {item.role_name} · {item.event_title} · {formatDate(item.event_starts_at)}
      </p>
      <FormError message={update.isError ? errorMessage(update.error) : null} />
      <div className={styles.actions}>
        <ButtonLink to={`/volunteer/${item.event_id}`} variant="ghost" size="small">
          Open
        </ButtonLink>
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
            update.mutate({ signupId: item.signup_id, changes: { hours_confirmed: Number(hours) } })
          }
        >
          Confirm hours
        </Button>
      </div>
    </Card>
  );
}
