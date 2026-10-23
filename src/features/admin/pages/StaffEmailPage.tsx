// Admin > Notifications > Staff email (Q15). When the daily digest goes out,
// and for each teacher and admin: email on or off, and every email at once
// (immediate) or one daily digest. Urgent emails always go at once.
// Default, with no setting saved: email (as a digest) only for staff who hold
// a responsibility, as the plan describes.
import { useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SelectField, TextField } from '@/components/Input';
import { ErrorState, LoadingState } from '@/components/States';
import { useAppSettings } from '@/features/settings/hooks';
import { responsibilityLabel } from '@/lib/status';
import type { StaffEmailSetting } from '../api';
import { AdminPage } from '../components/AdminPage';
import { useSetStaffEmail, useStaffEmailSettings, useUpdateSettings } from '../hooks';
import styles from './ListPage.module.css';

type Choice = 'default' | 'off' | 'digest' | 'immediate';

function choiceOf(person: StaffEmailSetting): Choice {
  if (!person.has_setting) return 'default';
  if (!person.enabled) return 'off';
  return person.mode;
}

export function StaffEmailPage() {
  const staff = useStaffEmailSettings();
  return (
    <AdminPage title="Staff email" description="When the digest goes out, and who gets email.">
      <DigestTime />
      <Card className="stack-tight">
        <h2 className={styles.cardTitle}>Who gets email</h2>
        <p className="meta">
          “Default” means: a daily digest if they hold a responsibility, otherwise no email. Urgent
          items always go straight away. Everyone still gets in-app and phone notifications.
        </p>
        {staff.isPending && <LoadingState shape="row" />}
        {staff.isError && <ErrorState error={staff.error} onRetry={() => staff.refetch()} />}
        <ul>
          {staff.data?.map((person) => (
            <StaffRow key={person.user_id} person={person} />
          ))}
        </ul>
      </Card>
    </AdminPage>
  );
}

function StaffRow({ person }: { person: StaffEmailSetting }) {
  const save = useSetStaffEmail();
  const choice = choiceOf(person);

  function change(next: Choice) {
    save.mutate({
      userId: person.user_id,
      setting:
        next === 'default'
          ? null
          : next === 'off'
            ? { enabled: false, mode: 'digest' }
            : { enabled: true, mode: next },
    });
  }

  return (
    <li className={`${styles.row} ${styles.staffRow}`}>
      <span className={styles.rowButton}>
        <span className={styles.rowTitle}>{person.full_name}</span>
        <span className="meta">{person.email}</span>
        {person.responsibilities.length > 0 && (
          <span className="row-wrap">
            {person.responsibilities.map((kind) => (
              <Badge key={kind} tone="good">
                {responsibilityLabel[kind]}
              </Badge>
            ))}
          </span>
        )}
      </span>
      <SelectField
        label={`Email for ${person.full_name}`}
        value={choice}
        disabled={save.isPending}
        onChange={(e) => change(e.target.value as Choice)}
      >
        <option value="default">
          Default ({person.responsibilities.length > 0 ? 'daily digest' : 'off'})
        </option>
        <option value="digest">Daily digest</option>
        <option value="immediate">Every email at once</option>
        <option value="off">Off</option>
      </SelectField>
    </li>
  );
}

function DigestTime() {
  const settings = useAppSettings();
  if (!settings.data) return null;
  return (
    <DigestForm key={settings.data.digest_time} saved={settings.data.digest_time.slice(0, 5)} />
  );
}

function DigestForm({ saved }: { saved: string }) {
  const save = useUpdateSettings();
  const [time, setTime] = useState(saved);
  return (
    <Card className="stack-tight">
      <div className={styles.addRow}>
        <TextField
          label="Daily digest time (Dubai)"
          type="time"
          hint="Staff on the digest get one email a day, after this time."
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <Button
          variant="secondary"
          disabled={!time || time === saved}
          loading={save.isPending}
          onClick={() => save.mutate({ digest_time: time })}
        >
          Save
        </Button>
      </div>
    </Card>
  );
}
