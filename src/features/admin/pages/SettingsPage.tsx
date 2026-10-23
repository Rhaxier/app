// Admin > System > Sign-in: who can sign in (Q3, Q5): the school's email
// domain, an optional staff email pattern, and the dev test accounts. The
// other settings in app_settings sit with what they change (Branding, the
// feature pages, School calendar, Notifications).
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
    <AdminPage title="Sign-in" description="Who can sign in, and who becomes staff.">
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

      <FormError message={save.isError ? errorMessage(save.error) : null} />
      {save.isSuccess && <p className={styles.saved}>Saved.</p>}
      <Button type="submit" fullWidth loading={save.isPending}>
        Save
      </Button>
    </form>
  );
}
