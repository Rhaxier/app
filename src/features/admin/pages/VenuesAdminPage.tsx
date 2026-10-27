// Admin > Features > Venues (Q2, Q6, Q10, Q48). Who may request venues,
// whether bookings must follow the bell times, when venue staff are reminded,
// and per venue: where it is, how many people it holds, whether bookings need
// approval, and when, how long and how far ahead it can be booked. The
// database enforces those limits on every request.
// Venues are retired ("not bookable") rather than deleted: bookings refer to them.
import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckboxField, FieldRow, FormError, SelectField, TextField } from '@/components/Input';
import { Sheet } from '@/components/Sheet';
import { ErrorState, LoadingState } from '@/components/States';
import { useRooms } from '@/features/map/hooks';
import type { Venue } from '@/features/venues/api';
import { useVenues } from '@/features/venues/hooks';
import { errorMessage } from '@/lib/errors';
import { AdminPage } from '../components/AdminPage';
import { SettingNumber, SettingSwitch } from '../components/SettingControls';
import { useSaveVenue } from '../hooks';
import { validateVenue, type VenueFormValues } from '../logic';
import styles from './VenuesAdminPage.module.css';

/** "07:00–18:00 · up to 4 h · 60 days ahead", or nothing when there are no limits. */
function limitsOf(venue: Venue): string {
  const parts = [];
  if (venue.bookable_from || venue.bookable_until)
    parts.push(
      `${venue.bookable_from?.slice(0, 5) ?? 'any time'}–${venue.bookable_until?.slice(0, 5) ?? 'any time'}`,
    );
  if (venue.max_booking_minutes) parts.push(`up to ${venue.max_booking_minutes} min`);
  if (venue.max_days_ahead !== null) parts.push(`${venue.max_days_ahead} days ahead`);
  return parts.join(' · ');
}

export function VenuesAdminPage() {
  const venues = useVenues();
  // undefined = closed, null = adding a new venue, Venue = editing it.
  const [editing, setEditing] = useState<Venue | null | undefined>(undefined);

  return (
    <AdminPage
      title="Venues"
      description="Who can book, when, and the rules for each venue."
      actions={
        <Button size="small" icon="plus" onClick={() => setEditing(null)}>
          Add
        </Button>
      }
    >
      <Card className="stack-tight">
        <SettingSwitch
          setting="students_can_request_venues"
          label="Students can request venues"
          hint="Q2. They name a supervising teacher, who confirms first."
        />
        <SettingSwitch
          setting="allow_custom_booking_times"
          label="Allow custom booking times"
          hint="Off: bookings follow the bell times (one period, or several in a row). On: people can also pick any start and end, e.g. after school. Each venue's limits still apply."
        />
        <p className="meta">Remind venue staff about a waiting request when (Q10):</p>
        <SettingNumber
          setting="venue_reminder_hours"
          label="Pending for (hours)"
          min={1}
          max={720}
        />
        <SettingNumber
          setting="venue_reminder_days_before"
          label="The event is within (days)"
          min={0}
          max={60}
        />
      </Card>

      {venues.isPending && <LoadingState shape="row" />}
      {venues.isError && <ErrorState error={venues.error} onRetry={() => venues.refetch()} />}
      <ul className="stack-tight">
        {venues.data?.map((venue) => (
          <li key={venue.id}>
            <button
              type="button"
              className={`${styles.venue} pressable`}
              onClick={() => setEditing(venue)}
            >
              <span>
                <span className={styles.name}>{venue.name}</span>
                <span className="meta">
                  {venue.room ? `Room ${venue.room.code}` : 'Not on the map'}
                  {venue.capacity ? ` · up to ${venue.capacity} people` : ''}
                </span>
                {limitsOf(venue) && <span className="meta">{limitsOf(venue)}</span>}
              </span>
              <span className="row-wrap">
                {!venue.needs_approval && <Badge tone="good">No approval</Badge>}
                {!venue.active && <Badge tone="quiet">Not bookable</Badge>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet
        open={editing !== undefined}
        title={editing ? `Edit ${editing.name}` : 'New venue'}
        onClose={() => setEditing(undefined)}
      >
        {editing !== undefined && (
          <VenueEditor
            key={editing?.id ?? 'new'}
            venue={editing}
            onClose={() => setEditing(undefined)}
          />
        )}
      </Sheet>
    </AdminPage>
  );
}

function VenueEditor({ venue, onClose }: { venue: Venue | null; onClose: () => void }) {
  const rooms = useRooms();
  const save = useSaveVenue();
  const [values, setValues] = useState<VenueFormValues>({
    name: venue?.name ?? '',
    roomId: venue?.room_id ?? '',
    capacity: venue?.capacity ? String(venue.capacity) : '',
    needsApproval: venue?.needs_approval ?? true,
    active: venue?.active ?? true,
    bookableFrom: venue?.bookable_from?.slice(0, 5) ?? '',
    bookableUntil: venue?.bookable_until?.slice(0, 5) ?? '',
    maxMinutes: venue?.max_booking_minutes ? String(venue.max_booking_minutes) : '',
    maxDaysAhead:
      venue?.max_days_ahead !== null && venue?.max_days_ahead !== undefined
        ? String(venue.max_days_ahead)
        : '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof VenueFormValues, string>>>({});
  const set = (changes: Partial<VenueFormValues>) => setValues((v) => ({ ...v, ...changes }));
  const numberOrNull = (text: string) => (text.trim() ? Number(text) : null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateVenue(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    save.mutate(
      {
        id: venue?.id ?? null,
        fields: {
          name: values.name.trim(),
          room_id: values.roomId || null,
          capacity: numberOrNull(values.capacity),
          needs_approval: values.needsApproval,
          active: values.active,
          bookable_from: values.bookableFrom || null,
          bookable_until: values.bookableUntil || null,
          max_booking_minutes: numberOrNull(values.maxMinutes),
          max_days_ahead: numberOrNull(values.maxDaysAhead),
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <form className="stack-tight" onSubmit={handleSubmit} noValidate>
      <TextField
        label="Name"
        value={values.name}
        onChange={(e) => set({ name: e.target.value })}
        error={errors.name}
      />
      <SelectField
        label="Room on the map"
        value={values.roomId}
        onChange={(e) => set({ roomId: e.target.value })}
      >
        <option value="">Not on the map</option>
        {rooms.data?.map((room) => (
          <option key={room.id} value={room.id}>
            {room.code} · {room.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Capacity (optional)"
        type="number"
        value={values.capacity}
        onChange={(e) => set({ capacity: e.target.value })}
        error={errors.capacity}
      />
      <p className="label">Booking limits (empty = no limit)</p>
      <FieldRow>
        <TextField
          label="Earliest start"
          type="time"
          value={values.bookableFrom}
          onChange={(e) => set({ bookableFrom: e.target.value })}
          error={errors.bookableFrom}
        />
        <TextField
          label="Latest end"
          type="time"
          value={values.bookableUntil}
          onChange={(e) => set({ bookableUntil: e.target.value })}
          error={errors.bookableUntil}
        />
        <TextField
          label="Longest booking (minutes)"
          type="number"
          value={values.maxMinutes}
          onChange={(e) => set({ maxMinutes: e.target.value })}
          error={errors.maxMinutes}
        />
        <TextField
          label="Days ahead"
          type="number"
          value={values.maxDaysAhead}
          onChange={(e) => set({ maxDaysAhead: e.target.value })}
          error={errors.maxDaysAhead}
        />
      </FieldRow>
      <CheckboxField
        label="Bookings need approval"
        hint="Untick for small rooms: free slots are then booked straight away."
        checked={values.needsApproval}
        onChange={(e) => set({ needsApproval: e.target.checked })}
      />
      <CheckboxField
        label="Bookable"
        hint="Untick to retire it: it leaves the calendar, existing bookings stay."
        checked={values.active}
        onChange={(e) => set({ active: e.target.checked })}
      />
      <FormError message={save.isError ? errorMessage(save.error) : null} />
      <Button type="submit" fullWidth loading={save.isPending}>
        Save
      </Button>
    </form>
  );
}
