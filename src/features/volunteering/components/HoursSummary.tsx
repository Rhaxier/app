// "Your SUPW hours": confirmed hours so far, and progress towards the target
// for your grade once the school sets one (Admin > Features > Volunteering,
// table supw_targets; docs/OPEN_QUESTIONS.md Q9).
import { Card } from '@/components/Card';
import { useCurrentUser } from '@/features/auth/hooks';
import type { MySignup } from '../api';
import { useSupwTargets } from '../hooks';
import { hoursSoFar } from '../logic';
import styles from './HoursSummary.module.css';

export function HoursSummary({ signups }: { signups: MySignup[] }) {
  const user = useCurrentUser();
  const targets = useSupwTargets();
  const hours = hoursSoFar(signups);
  const target = targets.data?.find((t) => t.grade === user.grade)?.hours ?? null;
  const share = target ? Math.min(1, hours / target) : 0;

  return (
    <Card className={styles.card}>
      <div className={styles.top}>
        <div>
          <p className="label">Your SUPW hours</p>
          <p className="meta">
            {target
              ? `Target for grade ${user.grade}: ${target} hours`
              : 'Confirmed by teachers after each event'}
          </p>
        </div>
        <p className={styles.hours}>
          {hours}
          {target ? <span className={styles.target}> / {target}</span> : null}
        </p>
      </div>
      {target && (
        // A meter: the track is the whole target, the fill is how far you've got.
        <div
          className={styles.track}
          role="meter"
          aria-label="SUPW hours towards your target"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={Math.min(hours, target)}
        >
          <span className={styles.fill} style={{ width: `${share * 100}%` }} />
        </div>
      )}
    </Card>
  );
}
