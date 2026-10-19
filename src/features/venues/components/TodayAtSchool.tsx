// "Today at school" on Home: today's approved venue bookings. Live through
// Realtime, so a booking approved this morning appears without a refresh.
import { Link } from 'react-router-dom';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/PageHeader';
import { dayKey, dayRange, formatTimeRange } from '@/lib/dates';
import { useApprovedBookings, useLiveBookings, useVenues } from '../hooks';
import styles from './TodayAtSchool.module.css';

export function TodayAtSchool() {
  const { start, end } = dayRange(dayKey());
  const bookings = useApprovedBookings(start, end);
  const venues = useVenues();
  useLiveBookings();

  // Quiet days don't need a section.
  if (!bookings.data || bookings.data.length === 0) return null;
  const venueName = (id: string) => venues.data?.find((venue) => venue.id === id)?.name ?? '';

  return (
    <section className="stack-tight" aria-labelledby="today-heading">
      <SectionHeader
        id="today-heading"
        title="Today at school"
        action={<Link to="/book">Calendar</Link>}
      />
      <Card as="div" className={styles.list}>
        <ul>
          {bookings.data.map((booking) => (
            <li key={booking.id} className={styles.item}>
              <span className={styles.time}>
                {formatTimeRange(booking.starts_at, booking.ends_at)}
              </span>
              <span className={styles.what}>
                <span className={styles.title}>{booking.title}</span>
                <span className="meta">{venueName(booking.venue_id)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
