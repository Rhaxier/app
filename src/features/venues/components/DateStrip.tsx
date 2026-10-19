// The row of school days (reference screen 4: Sun 12 … Thu 16), with arrows
// above it to move a week at a time. Days come from app_settings.school_days.
import { Icon } from '@/components/Icon';
import { atSchoolTime, dayKey, dayLabels, formatDate } from '@/lib/dates';
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
  const weekLabel = canGoBack
    ? `Week of ${formatDate(atSchoolTime(days[0], '12:00'))}`
    : 'This week';
  return (
    <div className={styles.wrap}>
      <div className={styles.weekRow}>
        <span className="meta">{weekLabel}</span>
        <span className={styles.arrows}>
          <button
            type="button"
            className={styles.arrow}
            onClick={onPreviousWeek}
            disabled={!canGoBack}
            aria-label="Previous week"
          >
            <Icon name="chevronLeft" size={20} />
          </button>
          <button
            type="button"
            className={styles.arrow}
            onClick={onNextWeek}
            aria-label="Next week"
          >
            <Icon name="chevronRight" size={20} />
          </button>
        </span>
      </div>
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
    </div>
  );
}
