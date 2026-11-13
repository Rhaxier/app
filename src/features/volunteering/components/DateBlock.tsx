// The "18 / SAT OCT" block on the left of each event card (design PDF page 7).
import { dateBlock } from '@/lib/dates';
import styles from './DateBlock.module.css';

export function DateBlock({ date }: { date: string }) {
  const { month, day, weekday } = dateBlock(date);
  return (
    <div className={styles.block} aria-hidden="true">
      <span className={styles.day}>{day}</span>
      <span className={styles.when}>
        {weekday}
        <br />
        {month}
      </span>
    </div>
  );
}
