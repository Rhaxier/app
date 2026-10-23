// Admin > Settings: everything the school hasn't decided yet, changeable
// without touching code (docs/OPEN_QUESTIONS.md). One row in app_settings.
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckboxField, FormError, TextField } from '@/components/Input';
import { ErrorState, LoadingState } from '@/components/States';
import type { AppSettings } from '@/features/settings/api';
import { useAppSettings } from '@/features/settings/hooks';
import { errorMessage } from '@/lib/errors';
import { useUpdateSettings } from '../hooks';
import {
  toSettingsChanges,
  validateSettings,
  valuesFromSettings,
  type SettingsFormErrors,
  type SettingsFormValues,
} from '../logic';
import styles from './SettingsPage.module.css';
import { AdminPage } from '../components/AdminPage';

export function SettingsPage() {
  const settings = useAppSettings();
  return (
    <AdminPage title="Settings">
      {settings.isPending && <LoadingState />}
      {settings.isError && <ErrorState error={settings.error} onRetry={() => settings.refetch()} />}
      {settings.data && <SettingsForm key={settings.data.updated_at} settings={settings.data} />}
    </AdminPage>
  );
}

function SettingsForm({ settings }: { settings: AppSettings }) {
  const save = useUpdateSettings();
  const [values, setValues] = useState(() => valuesFromSettings(settings));
  const [errors, setErrors] = useState<SettingsFormErrors>({});

  function update<K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateSettings(values);
    setErrors(found);
    if (Object.keys(found).length === 0) save.mutate(toSettingsChanges(values));
  }

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      <Card className="stack-tight">
        <h2 className={styles.heading}>School</h2>
        <TextField
          label="School name"
          value={values.schoolName}
          onChange={(e) => update('schoolName', e.target.value)}
          error={errors.schoolName}
        />
        <TextField
          label="SUPW hours target (optional)"
          type="number"
          min={0}
          hint="Shown to students next to their hours. Empty = no target."
          value={values.supwHoursTarget}
          onChange={(e) => update('supwHoursTarget', e.target.value)}
          error={errors.supwHoursTarget}
        />
      </Card>

      <Card className="stack-tight">
        <h2 className={styles.heading}>Sign-in</h2>
        <TextField
          label="School email domain"
          placeholder="school.example"
          hint="Only accounts on this domain (or its subdomains) can sign up."
          value={values.schoolEmailDomain}
          onChange={(e) => update('schoolEmailDomain', e.target.value)}
          error={errors.schoolEmailDomain}
        />
        <TextField
          label="Staff email pattern (optional)"
          placeholder="^[a-z]+\.[a-z]+@"
          hint="A regular expression. Matching addresses become teachers at first sign-in."
          value={values.staffEmailPattern}
          onChange={(e) => update('staffEmailPattern', e.target.value)}
          error={errors.staffEmailPattern}
        />
        <CheckboxField
          label="Allow dev accounts (@dev.local)"
          hint="The seeded test users. Turn this off before the app goes live."
          checked={values.allowDevAccounts}
          onChange={(e) => update('allowDevAccounts', e.target.checked)}
        />
      </Card>

      <Card className="stack-tight">
        <h2 className={styles.heading}>Rules</h2>
        <CheckboxField
          label="Students can request venues"
          hint="They must name a supervising teacher, who confirms first."
          checked={values.studentsCanRequestVenues}
          onChange={(e) => update('studentsCanRequestVenues', e.target.checked)}
        />
        <CheckboxField
          label="Collab posts need a supervising teacher"
          checked={values.collabRequiresTeacher}
          onChange={(e) => update('collabRequiresTeacher', e.target.checked)}
        />
      </Card>

      <Card className="stack-tight">
        <h2 className={styles.heading}>Venue booking</h2>
        <p className="meta">Remind venue staff about a waiting request when:</p>
        <div className={styles.twoColumns}>
          <TextField
            label="Pending for (hours)"
            type="number"
            value={values.venueReminderHours}
            onChange={(e) => update('venueReminderHours', e.target.value)}
            error={errors.venueReminderHours}
          />
          <TextField
            label="Event within (days)"
            type="number"
            value={values.venueReminderDaysBefore}
            onChange={(e) => update('venueReminderDaysBefore', e.target.value)}
            error={errors.venueReminderDaysBefore}
          />
        </div>
      </Card>

      <FormError message={save.isError ? errorMessage(save.error) : null} />
      {save.isSuccess && <p className={styles.saved}>Saved.</p>}
      <Button type="submit" fullWidth loading={save.isPending}>
        Save settings
      </Button>
    </form>
  );
}
