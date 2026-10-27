// Admin > School week and periods (Q11). Which weekdays are school days, and
// the periods of each day. Venue booking offers exactly these periods (and the
// database only accepts bookings that line up with them), so a short Friday is
// a set of periods that run only on Fridays. To change many at once, upload
// the timetable as a CSV file (Upload bell times).
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { FilterChip } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FieldRow, FormError, TextField } from '@/components/Input';
import { Sheet } from '@/components/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import type { Period } from '@/features/school/api';
import { useDeleteCalendarRow, usePeriods, useSaveCalendarRow } from '@/features/school/hooks';
import { WEEKDAY_NAMES, weekdaysLabel } from '@/features/school/logic';
import { useAppSettings } from '@/features/settings/hooks';
import { errorMessage } from '@/lib/errors';
import { AdminPage } from '../components/AdminPage';
import { useUpdateSettings } from '../hooks';
import { validatePeriod, type PeriodFormValues } from '../logic';
import styles from './ListPage.module.css';

export function SchoolWeekPage() {
  const periods = usePeriods();
  // undefined = closed, null = a new period, a period = editing it.
  const [editing, setEditing] = useState<Period | null | undefined>(undefined);

  return (
    <AdminPage
      title="School week and periods"
      description="School days, and the periods venues can be booked by."
      actions={
        <span className="row-wrap">
          <ButtonLink to="/admin/bell-times" size="small" variant="secondary" icon="download">
            Upload CSV
          </ButtonLink>
          <Button size="small" icon="plus" onClick={() => setEditing(null)}>
            Add period
          </Button>
        </span>
      }
    >
      <SchoolDays />

      <Card className="stack-tight">
        <h2 className={styles.cardTitle}>Periods</h2>
        <p className="meta">
          Venue booking offers these on the days they run, and everyone sees them under Bell times.
          Give a short day its own periods. Periods on the same day can't overlap.
        </p>
        {periods.isPending && <LoadingState shape="row" />}
        {periods.isError && <ErrorState error={periods.error} onRetry={() => periods.refetch()} />}
        {periods.data?.length === 0 && (
          <EmptyState icon="clock" title="No periods">
            Nothing can be booked until there are periods.
          </EmptyState>
        )}
        <ul>
          {periods.data?.map((period) => (
            <li key={period.id} className={styles.row}>
              <button
                type="button"
                className={`${styles.rowButton} pressable`}
                onClick={() => setEditing(period)}
              >
                <span className={styles.rowTitle}>{period.name}</span>
                <span className="meta">
                  {period.starts_at.slice(0, 5)}–{period.ends_at.slice(0, 5)} ·{' '}
                  {weekdaysLabel(period.weekdays)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Sheet
        open={editing !== undefined}
        title={editing ? `Edit ${editing.name}` : 'New period'}
        onClose={() => setEditing(undefined)}
      >
        {editing !== undefined && (
          <PeriodEditor
            key={editing?.id ?? 'new'}
            period={editing}
            onDone={() => setEditing(undefined)}
          />
        )}
      </Sheet>
    </AdminPage>
  );
}

function SchoolDays() {
  const settings = useAppSettings();
  const save = useUpdateSettings();
  const days = settings.data?.school_days ?? [];

  function toggle(day: number) {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    if (next.length > 0) save.mutate({ school_days: next.sort((a, b) => a - b) });
  }

  return (
    <Card className="stack-tight">
      <h2 className={styles.cardTitle}>School days</h2>
      <div className="row-wrap" role="group" aria-label="School days">
        {WEEKDAY_NAMES.map((name, day) => (
          <FilterChip key={name} selected={days.includes(day)} onClick={() => toggle(day)}>
            {name}
          </FilterChip>
        ))}
      </div>
      <p className="meta">
        Booking calendars show these days. Since 2022 most UAE schools run Monday to Friday.
      </p>
      <FormError message={save.isError ? errorMessage(save.error) : null} />
    </Card>
  );
}

function PeriodEditor({ period, onDone }: { period: Period | null; onDone: () => void }) {
  const save = useSaveCalendarRow('periods');
  const remove = useDeleteCalendarRow('periods');
  const [confirming, setConfirming] = useState(false);
  const [values, setValues] = useState<PeriodFormValues>({
    name: period?.name ?? '',
    startsAt: period?.starts_at.slice(0, 5) ?? '',
    endsAt: period?.ends_at.slice(0, 5) ?? '',
    weekdays: period?.weekdays ?? [1, 2, 3, 4, 5],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof PeriodFormValues, string>>>({});

  function submit() {
    const found = validatePeriod(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    save.mutate(
      {
        id: period?.id ?? null,
        fields: {
          name: values.name.trim(),
          starts_at: values.startsAt,
          ends_at: values.endsAt,
          weekdays: values.weekdays,
          sort_order: period?.sort_order ?? 0,
        },
      },
      { onSuccess: onDone },
    );
  }

  function toggleDay(day: number) {
    setValues((v) => ({
      ...v,
      weekdays: v.weekdays.includes(day)
        ? v.weekdays.filter((d) => d !== day)
        : [...v.weekdays, day].sort((a, b) => a - b),
    }));
  }

  return (
    <>
      <TextField
        label="Name"
        placeholder="Period 1"
        value={values.name}
        onChange={(e) => setValues({ ...values, name: e.target.value })}
        error={errors.name}
      />
      <FieldRow>
        <TextField
          label="Starts"
          type="time"
          value={values.startsAt}
          onChange={(e) => setValues({ ...values, startsAt: e.target.value })}
          error={errors.startsAt}
        />
        <TextField
          label="Ends"
          type="time"
          value={values.endsAt}
          onChange={(e) => setValues({ ...values, endsAt: e.target.value })}
          error={errors.endsAt}
        />
      </FieldRow>
      <fieldset className={styles.fieldset}>
        <legend className="label">Runs on</legend>
        <div className="row-wrap">
          {WEEKDAY_NAMES.map((name, day) => (
            <FilterChip
              key={name}
              selected={values.weekdays.includes(day)}
              onClick={() => toggleDay(day)}
            >
              {name}
            </FilterChip>
          ))}
        </div>
        {errors.weekdays && <p className={styles.warning}>{errors.weekdays}</p>}
      </fieldset>
      <FormError message={save.isError ? errorMessage(save.error) : null} />
      <Button fullWidth loading={save.isPending} onClick={submit}>
        Save period
      </Button>
      {period && (
        <Button variant="quiet" fullWidth icon="trash" onClick={() => setConfirming(true)}>
          Delete period
        </Button>
      )}
      <ConfirmDialog
        open={confirming}
        title={`Delete ${period?.name ?? 'this period'}?`}
        confirmLabel="Delete period"
        busy={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onClose={() => setConfirming(false)}
        onConfirm={() => period && remove.mutate(period.id, { onSuccess: onDone })}
      >
        <p>It won't be offered for booking any more. Existing bookings stay.</p>
      </ConfirmDialog>
    </>
  );
}
