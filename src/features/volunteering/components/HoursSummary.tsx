// "Your SUPW hours": confirmed hours so far, and the school's target once set
// (app_settings.supw_hours_target, docs/OPEN_QUESTIONS.md Q9).
import { Card } from '@/components/Card';
import { useAppSettings } from '@/features/settings/hooks';
import type { MySignup } from '../api';
import { hoursSoFar } from '../logic';
import styles from './HoursSummary.module.css';

export function HoursSummary({ signups }: { signups: MySignup[] }) {
  const settings = useAppSettings();
  const hours = hoursSoFar(signups);
  const target = settings.data?.supw_hours_target;

  return (
    <Card className={styles.card}>
      <div>
        <p className="label">Your SUPW hours</p>
        <p className="meta">Confirmed by teachers after each event</p>
      </div>
      <p className={styles.hours}>
        {hours}
        {target ? <span className={styles.target}> / {target}</span> : null}
      </p>
    </Card>
  );
}
