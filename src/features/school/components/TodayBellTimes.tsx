// Home: a one-line link to the bell times that says where today is up to
// ("Now: Period 2, until 10:30"). Tapping it shows every day's timings.
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { usePeriods } from '../hooks';
import { bellTimesSummary } from '../logic';
import styles from './TodayBellTimes.module.css';

export function TodayBellTimes() {
  const periods = usePeriods();
  return (
    <Link to="/bell-times" className={`${styles.card} pressable`}>
      <span className={styles.icon}>
        <Icon name="clock" size={20} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>Bell times</span>
        {periods.data && <span className="meta">{bellTimesSummary(periods.data)}</span>}
      </span>
      <Icon name="chevronRight" size={20} />
    </Link>
  );
}
