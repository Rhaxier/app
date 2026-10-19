// Admin > Settings: everything the school hasn't decided yet, changeable
// without touching code (docs/OPEN_QUESTIONS.md). One row in app_settings.
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FilterChip } from '@/components/Chip';
import { CheckboxField, FormError, TextField } from '@/components/Input';
import { PageHeader } from '@/components/PageHeader';
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

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Every grade the database accepts (profiles.grade is 1 to 13).
const allGrades = Array.from({ length: 13 }, (_, i) => i + 1);

export function SettingsPage() {
  const settings = useAppSettings();
  return (
    <div className="stack">
      <PageHeader back={{ to: '/admin', label: 'Admin' }} title="Settings" />
      {settings.isPending && <LoadingState />}
      {settings.isError && <ErrorState error={settings.error} onRetry={() => settings.refetch()} />}
      {settings.data && <SettingsForm key={settings.data.updated_at} settings={settings.data} />}
    </div>
  );
}

function SettingsForm({ settings }: { settings: AppSettings }) {
  const save = useUpdateSettings();
  const [values, setValues] = useState(() => valuesFromSettings(settings));
  const [errors, setErrors] = useState<SettingsFormErrors>({});

  function update<K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleDay(day: number) {
    update(
      'schoolDays',
      values.schoolDays.includes(day)
        ? values.schoolDays.filter((d) => d !== day)
        : [...values.schoolDays, day].sort(),
    );
  }

  function toggleGrade(grade: number) {
    update(
      'grades',
      values.grades.includes(grade)
        ? values.grades.filter((g) => g !== grade)
        : [...values.grades, grade].sort((a, b) => a - b),
    );
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
        <h2 className={styles.heading}>Grades</h2>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Grades that use the app</legend>
          <div className="row-wrap">
            {allGrades.map((grade) => (
              <FilterChip
                key={grade}
                selected={values.grades.includes(grade)}
                onClick={() => toggleGrade(grade)}
              >
                {grade}
              </FilterChip>
            ))}
          </div>
          {errors.grades && <p className={styles.error}>{errors.grades}</p>}
        </fieldset>
        <p className="meta">Offered when posting announcements and editing students.</p>
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
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>School days</legend>
          <div className="row-wrap">
            {weekdays.map((name, day) => (
              <FilterChip
                key={name}
                selected={values.schoolDays.includes(day)}
                onClick={() => toggleDay(day)}
              >
                {name}
              </FilterChip>
            ))}
          </div>
          {errors.schoolDays && <p className={styles.error}>{errors.schoolDays}</p>}
        </fieldset>
        <div className={styles.threeColumns}>
          <TextField
            label="Starts"
            type="time"
            value={values.bookingDayStart}
            onChange={(e) => update('bookingDayStart', e.target.value)}
            error={errors.bookingDayStart}
          />
          <TextField
            label="Minutes"
            type="number"
            value={values.bookingSlotMinutes}
            onChange={(e) => update('bookingSlotMinutes', e.target.value)}
            error={errors.bookingSlotMinutes}
          />
          <TextField
            label="Slots"
            type="number"
            value={values.bookingSlotsPerDay}
            onChange={(e) => update('bookingSlotsPerDay', e.target.value)}
            error={errors.bookingSlotsPerDay}
          />
        </div>
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
