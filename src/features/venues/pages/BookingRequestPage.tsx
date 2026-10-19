// The request form, reached from "Request 10:30–12:00" on the calendar.
// The venue and times come from the address (?venue=…&start=…&end=…).
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormError, TextArea, TextField } from '@/components/Input';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { TeacherSelect } from '@/features/people/TeacherSelect';
import { useAppSettings } from '@/features/settings/hooks';
import { formatDate, formatTimeRange } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { useRequestBooking, useVenues } from '../hooks';
import {
  emptyBookingValues,
  validateBooking,
  type BookingFormErrors,
  type BookingFormValues,
} from '../logic';
import styles from './BookingRequestPage.module.css';

export function BookingRequestPage() {
  const [params] = useSearchParams();
  const user = useCurrentUser();
  const settings = useAppSettings();
  const venues = useVenues();
  const request = useRequestBooking();
  const [values, setValues] = useState(emptyBookingValues);
  const [errors, setErrors] = useState<BookingFormErrors>({});

  const back = { to: '/book', label: 'Book a venue' };
  const venue = venues.data?.find((v) => v.id === params.get('venue'));
  const start = params.get('start');
  const end = params.get('end');
  const isStudent = user.role === 'student';

  if (venues.isPending || settings.isPending) return <LoadingState />;
  if (!venue || !start || !end) {
    return (
      <div className="stack">
        <PageHeader back={back} title="Request a venue" />
        <EmptyState
          icon="calendar"
          title="Choose a time first"
          action={<ButtonLink to="/book">Open the calendar</ButtonLink>}
        />
      </div>
    );
  }
  if (isStudent && settings.data && !settings.data.students_can_request_venues) {
    return (
      <div className="stack">
        <PageHeader back={back} title="Request a venue" />
        <EmptyState icon="calendar" title="Ask a teacher to book it">
          Students can't request venues at the moment.
        </EmptyState>
      </div>
    );
  }

  function update(key: keyof BookingFormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateBooking(values, { isStudent, capacity: venue!.capacity });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    request.mutate({
      venue_id: venue!.id,
      title: values.title.trim(),
      purpose: values.purpose.trim(),
      expected_attendance: values.expectedAttendance ? Number(values.expectedAttendance) : null,
      starts_at: start!,
      ends_at: end!,
      supervising_teacher_id: values.supervisingTeacherId || null,
    });
  }

  const when = `${formatDate(start)}, ${formatTimeRange(start, end)}`;

  if (request.isSuccess) {
    const booked = request.data.status === 'approved';
    return (
      <div className="stack">
        <PageHeader back={back} title={booked ? 'Booked' : 'Request sent'} />
        <Card className="stack-tight">
          <h3>{values.title}</h3>
          <p className="meta">
            {venue.name} · {when}
          </p>
          <p>
            {booked
              ? "It's confirmed. It now shows on the calendar for everyone."
              : request.data.status === 'awaiting_teacher'
                ? 'Your supervising teacher will confirm it, then venue staff decide. You will be notified.'
                : 'Venue staff will approve or reject it. You will be notified.'}
          </p>
        </Card>
        <ButtonLink to="/book/mine">See my bookings</ButtonLink>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader back={back} title="Request a venue" />
      <Card className={styles.summary}>
        <p className={styles.venue}>{venue.name}</p>
        <p className="meta">
          {when}
          {venue.capacity ? ` · up to ${venue.capacity} people` : ''}
        </p>
      </Card>
      <form className="stack" onSubmit={handleSubmit} noValidate>
        <TextField
          label="What's it for?"
          placeholder="e.g. Drama rehearsal"
          value={values.title}
          onChange={(e) => update('title', e.target.value)}
          error={errors.title}
        />
        <TextArea
          label="Details (optional)"
          rows={3}
          value={values.purpose}
          onChange={(e) => update('purpose', e.target.value)}
          error={errors.purpose}
        />
        <TextField
          label="How many people? (optional)"
          type="number"
          inputMode="numeric"
          min={1}
          value={values.expectedAttendance}
          onChange={(e) => update('expectedAttendance', e.target.value)}
          error={errors.expectedAttendance}
        />
        {isStudent && (
          <TeacherSelect
            label="Supervising teacher"
            hint="They confirm your request before venue staff see it."
            value={values.supervisingTeacherId}
            onChange={(id) => update('supervisingTeacherId', id)}
            error={errors.supervisingTeacherId}
          />
        )}
        <FormError message={request.isError ? errorMessage(request.error) : null} />
        <Button type="submit" fullWidth loading={request.isPending}>
          Send request
        </Button>
      </form>
    </div>
  );
}
