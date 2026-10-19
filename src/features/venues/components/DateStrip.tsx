// The row of school days (reference screen 4: Sun 12 … Thu 16), with arrows
// to move a week at a time. Days come from app_settings.school_days.
import { Icon } from '@/components/Icon';
import { dayKey, dayLabels } from '@/lib/dates';
import styles from './DateStrip.module.css';

interface DateStripProps {
  days: string[];
  selected: string;
  onSelect: (day: string) => void;
  canGoBack: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
}

export function DateStrip({
  days,
  selected,
  onSelect,
  canGoBack,
  onPreviousWeek,
  onNextWeek,
}: DateStripProps) {
  const today = dayKey();
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.arrow}
        onClick={onPreviousWeek}
        disabled={!canGoBack}
        aria-label="Previous week"
      >
        <Icon name="chevronLeft" size={20} />
      </button>
      <div className={styles.days} role="group" aria-label="Day">
        {days.map((day) => {
          const labels = dayLabels(day);
          return (
            <button
              key={day}
              type="button"
              className={styles.day}
              aria-pressed={day === selected}
              aria-label={labels.long}
              disabled={day < today}
              onClick={() => onSelect(day)}
            >
              <span className={styles.weekday}>{labels.weekday}</span>
              <span className={styles.date}>{labels.day}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className={styles.arrow} onClick={onNextWeek} aria-label="Next week">
        <Icon name="chevronRight" size={20} />
      </button>
    </div>
  );
}
