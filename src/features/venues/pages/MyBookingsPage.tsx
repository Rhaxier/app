// My bookings: your requests and their status, plus (for teachers) student
// requests waiting for you to confirm as supervisor.
import { useState } from 'react';
import { Button } from '@/components/Button';
import { FormError } from '@/components/Input';
import { PageHeader, SectionHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { errorMessage } from '@/lib/errors';
import { isStaff } from '@/lib/permissions';
import { BookingCard } from '../components/BookingCard';
import { SupervisorActions } from '../components/SupervisorActions';
import { useDecideBooking, useLiveBookings, useMyBookings, useToSupervise } from '../hooks';

export function MyBookingsPage() {
  const user = useCurrentUser();
  const mine = useMyBookings(user.id);
  const toSupervise = useToSupervise(user.id, isStaff(user));
  const decide = useDecideBooking();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  useLiveBookings();

  const now = new Date();
  const upcoming =
    mine.data?.filter(
      (b) => new Date(b.ends_at) >= now && !['rejected', 'cancelled'].includes(b.status),
    ) ?? [];
  const history = mine.data?.filter((b) => !upcoming.includes(b)) ?? [];

  return (
    <div className="stack">
      <PageHeader back={{ to: '/book', label: 'Book a venue' }} title="My bookings" />

      {isStaff(user) && (toSupervise.data?.length ?? 0) > 0 && (
        <section className="stack-tight" aria-labelledby="supervise-heading">
          <SectionHeader id="supervise-heading" title="Waiting for you" />
          <div className="card-grid">
            {toSupervise.data!.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                showRequester
                actions={<SupervisorActions booking={booking} />}
              />
            ))}
          </div>
        </section>
      )}

      {mine.isPending && <LoadingState />}
      {mine.isError && <ErrorState error={mine.error} onRetry={() => mine.refetch()} />}
      {mine.data?.length === 0 && (
        <EmptyState icon="calendar" title="No bookings yet">
          Pick a venue and a free time on the calendar.
        </EmptyState>
      )}
      <FormError message={decide.isError ? errorMessage(decide.error) : null} />

      {upcoming.length > 0 && (
        <section className="stack-tight" aria-labelledby="upcoming-heading">
          <SectionHeader id="upcoming-heading" title="Upcoming" />
          <div className="card-grid">
            {upcoming.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                actions={
                  <Button
                    variant="secondary"
                    size="small"
                    loading={decide.isPending && cancellingId === booking.id}
                    onClick={() => {
                      setCancellingId(booking.id);
                      decide.mutate({ id: booking.id, status: 'cancelled' });
                    }}
                  >
                    Cancel booking
                  </Button>
                }
              />
            ))}
          </div>
        </section>
      )}
      {history.length > 0 && (
        <section className="stack-tight" aria-labelledby="history-heading">
          <SectionHeader id="history-heading" title="Past and closed" />
          <div className="card-grid">
            {history.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
