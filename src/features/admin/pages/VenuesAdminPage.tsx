// Admin > Venues (Q6): what can be booked, where it is on the map, how many
// people it holds, and whether bookings need approval.
import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { CheckboxField, FormError, SelectField, TextField } from '@/components/Input';
import { PageHeader } from '@/components/PageHeader';
import { Sheet } from '@/components/Sheet';
import { ErrorState, LoadingState } from '@/components/States';
import { useRooms } from '@/features/map/hooks';
import type { Venue } from '@/features/venues/api';
import { useVenues } from '@/features/venues/hooks';
import { errorMessage } from '@/lib/errors';
import { useSaveVenue } from '../hooks';
import { validateVenue, type VenueFormValues } from '../logic';
import styles from './VenuesAdminPage.module.css';

export function VenuesAdminPage() {
  const venues = useVenues();
  // undefined = closed, null = adding a new venue, Venue = editing it.
  const [editing, setEditing] = useState<Venue | null | undefined>(undefined);

  return (
    <div className="stack">
      <PageHeader
        back={{ to: '/admin', label: 'Admin' }}
        title="Venues"
        action={
          <Button size="small" icon="plus" onClick={() => setEditing(null)}>
            Add
          </Button>
        }
      />
      {venues.isPending && <LoadingState />}
      {venues.isError && <ErrorState error={venues.error} onRetry={() => venues.refetch()} />}
      <ul className="stack-tight">
        {venues.data?.map((venue) => (
          <li key={venue.id}>
            <button type="button" className={styles.venue} onClick={() => setEditing(venue)}>
              <span>
                <span className={styles.name}>{venue.name}</span>
                <span className="meta">
                  {venue.room ? `Room ${venue.room.code}` : 'Not on the map'}
                  {venue.capacity ? ` · up to ${venue.capacity}` : ''}
                </span>
              </span>
              <span className="row-wrap">
                {!venue.needs_approval && <Badge tone="good">No approval</Badge>}
                {!venue.active && <Badge tone="quiet">Hidden</Badge>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {editing !== undefined && (
        <VenueEditor
          key={editing?.id ?? 'new'}
          venue={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
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
  });
  const [errors, setErrors] = useState<Partial<Record<keyof VenueFormValues, string>>>({});

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
          capacity: values.capacity ? Number(values.capacity) : null,
          needs_approval: values.needsApproval,
          active: values.active,
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Sheet open title={venue ? `Edit ${venue.name}` : 'New venue'} onClose={onClose}>
      <form className="stack-tight" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Name"
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          error={errors.name}
        />
        <SelectField
          label="Room on the map"
          value={values.roomId}
          onChange={(e) => setValues({ ...values, roomId: e.target.value })}
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
          onChange={(e) => setValues({ ...values, capacity: e.target.value })}
          error={errors.capacity}
        />
        <CheckboxField
          label="Bookings need approval"
          hint="Untick for small rooms: free slots are then booked straight away."
          checked={values.needsApproval}
          onChange={(e) => setValues({ ...values, needsApproval: e.target.checked })}
        />
        <CheckboxField
          label="Bookable"
          hint="Untick to hide it from the calendar (existing bookings stay)."
          checked={values.active}
          onChange={(e) => setValues({ ...values, active: e.target.checked })}
        />
        <FormError message={save.isError ? errorMessage(save.error) : null} />
        <Button type="submit" fullWidth loading={save.isPending}>
          Save
        </Button>
      </form>
    </Sheet>
  );
}
