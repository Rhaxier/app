// "Your SUPW hours" (design PDF page 7, "Hours as a number"): one large
// figure, the target for your grade once the school sets one (Admin >
// Features > Volunteering, table supw_targets; docs/OPEN_QUESTIONS.md Q9),
// and a small chart of the last eight weeks.
import { useCurrentUser } from '@/features/auth/hooks';
import type { MySignup, VolunteerEvent } from '../api';
import { useSupwTargets } from '../hooks';
import { hoursByWeek, hoursSoFar } from '../logic';
import styles from './HoursSummary.module.css';

interface HoursSummaryProps {
  signups: MySignup[];
  /** To place each sign-up's hours in the week its event happened. */
  events: VolunteerEvent[];
}

export function HoursSummary({ signups, events }: HoursSummaryProps) {
  const user = useCurrentUser();
  const targets = useSupwTargets();
  const hours = hoursSoFar(signups);
  const target = targets.data?.find((t) => t.grade === user.grade)?.hours ?? null;
  const weeks = hoursByWeek(signups, events);
  const busiest = Math.max(...weeks, 1);

  const line = !target
    ? 'Confirmed by teachers after each event'
    : hours >= target
      ? `Grade ${user.grade} target · reached`
      : `Grade ${user.grade} target · ${target - hours} to go`;

  return (
    <section className={styles.summary} aria-label="Your SUPW hours">
      <div>
        <p className={styles.figure}>
          {hours}
          <span className={styles.unit}>
            {target ? ` / ${target} hours` : hours === 1 ? ' hour' : ' hours'}
          </span>
        </p>
        <p className={styles.line}>{line}</p>
      </div>
      {/* Weeks with hours are bars; weeks without are small squares. */}
      <ol
        className={styles.chart}
        aria-label={`Hours in each of the last ${weeks.length} weeks, oldest first: ${weeks.join(', ')}`}
      >
        {weeks.map((value, index) => (
          <li
            key={index}
            className={value > 0 ? styles.bar : styles.empty}
            style={value > 0 ? { height: `${Math.max(25, (value / busiest) * 100)}%` } : undefined}
          />
        ))}
      </ol>
    </section>
  );
}
