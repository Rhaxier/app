// One event in the Volunteer list (reference screen 3; design PDF page 7,
// "Roles with capacity"): the date, title, organiser and time, place, your
// place in it ("You're in · Setup crew") or "Pick a role", then each role with
// a bar showing how full it is, so the gaps are obvious.
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { StatusBadge } from '@/components/StatusBadge';
import { formatTimeRange } from '@/lib/dates';
import { volunteerEventStatus } from '@/lib/status';
import type { MySignup, VolunteerEvent } from '../api';
import { eventSpotsLeft, isSignupOpen, placeOf } from '../logic';
import { DateBlock } from './DateBlock';
import styles from './EventCard.module.css';

interface EventCardProps {
  event: VolunteerEvent;
  /** Your sign-up for this event, if you're taking part. */
  signup?: MySignup;
}

// What your sign-up chip says: selected is blue ("yours"), the rest are waiting.
const signupWords: Partial<Record<MySignup['status'], string>> = {
  selected: "You're in",
  applied: 'Signed up',
  waitlisted: 'Waitlisted',
};

export function EventCard({ event, signup }: EventCardProps) {
  const spots = eventSpotsLeft(event);
  const open = isSignupOpen(event);
  const organiser = event.organiser_label || event.creator?.full_name;
  const role = signup && event.roles.find((r) => r.id === signup.role_id);
  const chosen = signup?.status === 'selected';

  return (
    <article className={`${styles.card} pressable-card`}>
      <div className={styles.row}>
        <DateBlock date={event.starts_at} />
        <div className={styles.content}>
          <div className={styles.titleRow}>
            <h3>
              <Link to={`/volunteer/${event.id}`} className={styles.titleLink}>
                {event.title}
              </Link>
            </h3>
            {event.status !== 'published' && (
              <StatusBadge map={volunteerEventStatus} status={event.status} />
            )}
          </div>
          <p className="meta">
            {[organiser, formatTimeRange(event.starts_at, event.ends_at)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="meta">{placeOf(event)}</p>

          {signup ? (
            <p className={`${styles.chip} ${chosen ? styles.chosen : styles.waiting}`}>
              {chosen && <Icon name="check" size={14} />}
              {signupWords[signup.status]}
              {role && ` · ${role.name}`}
            </p>
          ) : (
            open && (
              <Link
                to={`/volunteer/${event.id}`}
                className={styles.pick}
                aria-label={`${spots > 0 ? 'Sign up for' : 'Join the waitlist for'} ${event.title}`}
              >
                {spots > 0 ? 'Pick a role' : 'Join the waitlist'}
                <Icon name="arrowRight" size={15} />
              </Link>
            )
          )}
        </div>
      </div>

      {event.roles.length > 0 && (
        <ul className={styles.roles} aria-label="Roles">
          {event.roles.map((r) => {
            const filled = Math.min(r.selected_count, r.spots_wanted);
            return (
              <li key={r.id} className={styles.role}>
                <span className={styles.roleName}>{r.name}</span>
                <span className={styles.meter} aria-hidden="true">
                  <span style={{ width: `${(filled / r.spots_wanted) * 100}%` }} />
                </span>
                <span className={styles.count}>
                  {filled}/{r.spots_wanted}
                  <span className="visually-hidden"> filled</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
