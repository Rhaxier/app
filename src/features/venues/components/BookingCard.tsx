// A booking with its details, used on My bookings and in the Approvals queue.
// `actions` holds whatever buttons the screen offers (cancel, approve, …).
import type { ReactNode } from 'react';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatTimeRange } from '@/lib/dates';
import { bookingStatus } from '@/lib/status';
import type { BookingDetails } from '../api';
import styles from './BookingCard.module.css';

interface BookingCardProps {
  booking: BookingDetails;
  /** Show who asked (for supervisors and venue staff). */
  showRequester?: boolean;
  actions?: ReactNode;
}

export function BookingCard({ booking, showRequester, actions }: BookingCardProps) {
  return (
    <Card as="article" className={styles.card}>
      <div className={styles.top}>
        <h3>{booking.title}</h3>
        <StatusBadge map={bookingStatus} status={booking.status} />
      </div>
      <p className="meta">
        {booking.venue_name} · {formatDate(booking.starts_at)},{' '}
        {formatTimeRange(booking.starts_at, booking.ends_at)}
      </p>
      {showRequester && (
        <p className="meta">
          From {booking.requester_name}
          {booking.requester_role === 'student' ? ' (student)' : ''}
          {booking.expected_attendance ? ` · ${booking.expected_attendance} people` : ''}
        </p>
      )}
      {booking.supervising_teacher_name && (
        <p className="meta">Supervisor: {booking.supervising_teacher_name}</p>
      )}
      {booking.purpose && <p className={styles.purpose}>{booking.purpose}</p>}
      {booking.overlaps_pending > 0 && ['pending', 'awaiting_teacher'].includes(booking.status) && (
        <p className={styles.overlap}>
          {booking.overlaps_pending} other{' '}
          {booking.overlaps_pending === 1 ? 'request wants' : 'requests want'} this slot. Approving
          this one rejects {booking.overlaps_pending === 1 ? 'it' : 'them'}.
        </p>
      )}
      {booking.review_note && <p className={styles.note}>{booking.review_note}</p>}
      {actions}
    </Card>
  );
}
