// Admin > Venue blackouts: days a venue (or every venue) can't be booked,
// e.g. "Exams". The database refuses booking requests that touch them, and
// the booking calendar greys them out with the reason.
import { useBlackouts } from '@/features/school/hooks';
import { useVenues } from '@/features/venues/hooks';
import { AdminPage } from '../components/AdminPage';
import { footnotes, pageIntros } from '../strings';
import { DateRangeList } from '../components/DateRangeList';

export function BlackoutsPage() {
  const blackouts = useBlackouts();
  const venues = useVenues();
  return (
    <AdminPage title="Venue blackouts" description={pageIntros.blackouts}>
      <DateRangeList
        table="venue_blackouts"
        title="Blackouts"
        noun="blackout"
        description={footnotes.blackouts.list}
        rows={blackouts.data?.map((b) => ({ ...b, name: b.reason }))}
        loading={blackouts.isPending || venues.isPending}
        error={blackouts.error ?? venues.error}
        onRetry={() => blackouts.refetch()}
        venues={venues.data ?? []}
      />
    </AdminPage>
  );
}
