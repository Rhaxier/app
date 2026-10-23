// A list of date ranges with add, edit and delete: terms, holidays and venue
// blackouts all look the same (a name and a first and last day). Blackouts also
// say which venue; "All venues" is stored as no venue.
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormError, SelectField, TextField } from '@/components/Input';
import { Sheet } from '@/components/Sheet';
import { ErrorState, LoadingState } from '@/components/States';
import { useDeleteCalendarRow, useSaveCalendarRow } from '@/features/school/hooks';
import type { Venue } from '@/features/venues/api';
import { formatDayRange } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { validateRange, type RangeFormValues } from '../logic';
import styles from '../pages/ListPage.module.css';

/** One row, whichever table it comes from (blackouts call the name "reason"). */
export interface DateRange {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  venue_id?: string | null;
}

interface DateRangeListProps {
  table: 'terms' | 'holidays' | 'venue_blackouts';
  title: string;
  description: string;
  /** "term", "holiday", "blackout": used in button labels. */
  noun: string;
  rows: DateRange[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  /** Blackouts only: the venues to choose from. */
  venues?: Venue[];
}

export function DateRangeList({
  table,
  title,
  description,
  noun,
  rows,
  loading,
  error,
  onRetry,
  venues,
}: DateRangeListProps) {
  // undefined = closed, null = new, a row = editing it.
  const [editing, setEditing] = useState<DateRange | null | undefined>(undefined);
  const venueName = (id: string | null | undefined) =>
    id ? (venues?.find((v) => v.id === id)?.name ?? 'A venue') : 'All venues';

  return (
    <Card as="section" className="stack-tight" aria-label={title}>
      <div className={styles.row}>
        <h2 className={styles.cardTitle}>{title}</h2>
        <Button size="small" variant="secondary" icon="plus" onClick={() => setEditing(null)}>
          Add {noun}
        </Button>
      </div>
      <p className="meta">{description}</p>
      {loading && <LoadingState shape="row" count={2} />}
      {Boolean(error) && <ErrorState error={error} onRetry={onRetry} />}
      {rows?.length === 0 && <p className="meta">None yet.</p>}
      <ul>
        {rows?.map((row) => (
          <li key={row.id} className={styles.row}>
            <button
              type="button"
              className={`${styles.rowButton} pressable`}
              onClick={() => setEditing(row)}
            >
              <span className={styles.rowTitle}>{row.name}</span>
              <span className="meta">
                {formatDayRange(row.starts_on, row.ends_on)}
                {venues ? ` · ${venueName(row.venue_id)}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet
        open={editing !== undefined}
        title={editing ? `Edit ${editing.name}` : `New ${noun}`}
        onClose={() => setEditing(undefined)}
      >
        {editing !== undefined && (
          <RangeEditor
            key={editing?.id ?? 'new'}
            table={table}
            noun={noun}
            row={editing}
            venues={venues}
            onDone={() => setEditing(undefined)}
          />
        )}
      </Sheet>
    </Card>
  );
}

interface RangeEditorProps {
  table: DateRangeListProps['table'];
  noun: string;
  row: DateRange | null;
  venues?: Venue[];
  onDone: () => void;
}

function RangeEditor({ table, noun, row, venues, onDone }: RangeEditorProps) {
  const save = useSaveCalendarRow(table);
  const remove = useDeleteCalendarRow(table);
  const [confirming, setConfirming] = useState(false);
  const [values, setValues] = useState<RangeFormValues>({
    name: row?.name ?? '',
    startsOn: row?.starts_on ?? '',
    endsOn: row?.ends_on ?? '',
  });
  const [venueId, setVenueId] = useState(row?.venue_id ?? '');
  const [errors, setErrors] = useState<Partial<Record<keyof RangeFormValues, string>>>({});

  function submit() {
    const found = validateRange(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const dates = { starts_on: values.startsOn, ends_on: values.endsOn };
    // Each table names its text column differently; the hook knows which is which.
    const fields =
      table === 'venue_blackouts'
        ? { ...dates, reason: values.name.trim(), venue_id: venueId || null }
        : { ...dates, name: values.name.trim() };
    save.mutate(
      { id: row?.id ?? null, fields: fields as Parameters<typeof save.mutate>[0]['fields'] },
      { onSuccess: onDone },
    );
  }

  return (
    <>
      <TextField
        label={table === 'venue_blackouts' ? 'Reason (shown to people booking)' : 'Name'}
        placeholder={table === 'venue_blackouts' ? 'Exams' : undefined}
        value={values.name}
        onChange={(e) => setValues({ ...values, name: e.target.value })}
        error={errors.name}
      />
      {venues && (
        <SelectField label="Venue" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
          <option value="">All venues</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </SelectField>
      )}
      <div className={styles.twoColumns}>
        <TextField
          label="First day"
          type="date"
          value={values.startsOn}
          onChange={(e) =>
            setValues({
              ...values,
              startsOn: e.target.value,
              endsOn: values.endsOn || e.target.value,
            })
          }
          error={errors.startsOn}
        />
        <TextField
          label="Last day"
          type="date"
          value={values.endsOn}
          onChange={(e) => setValues({ ...values, endsOn: e.target.value })}
          error={errors.endsOn}
        />
      </div>
      <FormError message={save.isError ? errorMessage(save.error) : null} />
      <Button fullWidth loading={save.isPending} onClick={submit}>
        Save {noun}
      </Button>
      {row && (
        <Button variant="quiet" fullWidth icon="trash" onClick={() => setConfirming(true)}>
          Delete {noun}
        </Button>
      )}
      <ConfirmDialog
        open={confirming}
        title={`Delete ${row?.name ?? `this ${noun}`}?`}
        confirmLabel={`Delete ${noun}`}
        busy={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onClose={() => setConfirming(false)}
        onConfirm={() => row && remove.mutate(row.id, { onSuccess: onDone })}
      >
        <p>
          {table === 'terms'
            ? 'Dates outside every term are marked "Outside term time".'
            : 'Those days can be booked again.'}
        </p>
      </ConfirmDialog>
    </>
  );
}
