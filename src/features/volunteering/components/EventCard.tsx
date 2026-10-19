// One event in the Volunteer list (reference screen 3): date block, title,
// organiser and time, place, spots left, and a Sign up button that opens the
// event to pick a role.
import { Link } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { formatTimeRange } from '@/lib/dates';
import { volunteerEventStatus } from '@/lib/status';
import type { VolunteerEvent } from '../api';
import { eventSpotsLeft, isSignupOpen, placeOf } from '../logic';
import { DateBlock } from './DateBlock';
import styles from './EventCard.module.css';

interface EventCardProps {
  event: VolunteerEvent;
  signedUp: boolean;
}

export function EventCard({ event, signedUp }: EventCardProps) {
  const spots = eventSpotsLeft(event);
  const open = isSignupOpen(event);
  const organiser = event.organiser_label || event.creator?.full_name;

  return (
    <Card as="article" className={styles.card}>
      <div className={styles.row}>
        <DateBlock date={event.starts_at} />
        <div className={styles.content}>
          <div className={styles.titleRow}>
            <h3>
              <Link to={`/volunteer/${event.id}`} className={styles.titleLink}>
                {event.title}
              </Link>
            </h3>
            {signedUp ? (
              <Badge tone="good">Signed up</Badge>
            ) : (
              event.status !== 'published' && (
                <StatusBadge map={volunteerEventStatus} status={event.status} />
              )
            )}
          </div>
          <p className="meta">
            {[organiser, formatTimeRange(event.starts_at, event.ends_at)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="meta">{placeOf(event)}</p>
          {open && (
            <p className="meta">
              {spots > 0
                ? `${spots} ${spots === 1 ? 'spot' : 'spots'} left`
                : 'Full: waitlist only'}
            </p>
          )}
        </div>
      </div>
      {open && !signedUp && (
        <ButtonLink
          to={`/volunteer/${event.id}`}
          variant={spots > 0 ? 'primary' : 'secondary'}
          fullWidth
          aria-label={`Sign up for ${event.title}`}
        >
          {spots > 0 ? 'Sign up' : 'Join the waitlist'}
        </ButtonLink>
      )}
    </Card>
  );
}
