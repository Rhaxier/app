// The sheet over the map for the selected room (like the mockup's bottom
// sheet, in thick glass above the tab bar): what it is, whether it's in use
// now, and what you can do there.
import { ButtonLink } from '@/components/Button';
import { formatTime } from '@/lib/dates';
import { roomKindLabel } from '@/lib/status';
import type { CalendarBooking, Venue } from '@/features/venues/api';
import type { Room } from '../api';
import styles from './DetailCard.module.css';

interface RoomCardProps {
  room: Room;
  inUse?: CalendarBooking;
  venue?: Venue;
  openReports: number;
}

export function RoomCard({ room, inUse, venue, openReports }: RoomCardProps) {
  return (
    <section className={`glass thick ${styles.sheet}`} aria-label="Room" aria-live="polite">
      <p className={`label ${styles.roomLabel}`}>
        {roomKindLabel[room.kind]} · <span className={styles.code}>{room.code}</span>
      </p>
      <h2 className={styles.title}>{room.name}</h2>
      {inUse ? (
        <p className={styles.busy}>
          In use now: {inUse.title}, until {formatTime(inUse.ends_at)}
        </p>
      ) : (
        <p className="meta">Free right now</p>
      )}
      {openReports > 0 && (
        <p className={styles.reports}>
          {openReports} open fix-it {openReports === 1 ? 'report' : 'reports'} here
        </p>
      )}
      <div className={styles.actions}>
        {venue?.active && (
          <ButtonLink to={`/book?venue=${venue.id}`} variant="secondary">
            Book
          </ButtonLink>
        )}
        <ButtonLink to={`/map/report?room=${room.id}`} icon="camera">
          Report an issue
        </ButtonLink>
      </div>
    </section>
  );
}
