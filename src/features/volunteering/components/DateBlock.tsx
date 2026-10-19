// The OCT / 18 / Sat block on the left of each event card.
import { dateBlock } from '@/lib/dates';
import styles from './DateBlock.module.css';

export function DateBlock({ date }: { date: string }) {
  const { month, day, weekday } = dateBlock(date);
  return (
    <div className={styles.block} aria-hidden="true">
      <span className={styles.month}>{month}</span>
      <span className={styles.day}>{day}</span>
      <span className={styles.weekday}>{weekday}</span>
    </div>
  );
}
