// The row of school days (reference screen 4: Sun 12 … Thu 16), with arrows
// above it to move a week at a time. Days come from app_settings.school_days.
// Days that can't be booked (past, holidays, blackouts, no periods) are greyed
// out, and the reason is read out and listed under the strip.
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
  /** Why a day is special ("Holiday: …"), or null. */
  dayNoteFor?: (day: string) => string | null;
  isDisabled?: (day: string) => boolean;
}

export function DateStrip({
  days,
  selected,
  onSelect,
  canGoBack,
  onPreviousWeek,
  onNextWeek,
  dayNoteFor = () => null,
  isDisabled = () => false,
}: DateStripProps) {
  const today = dayKey();
  const weekLabel = canGoBack
    ? `Week of ${formatDate(atSchoolTime(days[0], '12:00'))}`
    : 'This week';
  const notes = days
    .filter((day) => day >= today)
    .map((day) => ({ day, note: dayNoteFor(day) }))
    .filter((entry): entry is { day: string; note: string } => entry.note !== null);
  return (
    <div className={styles.wrap}>
      <div className={styles.weekRow}>
        <span className="meta">{weekLabel}</span>
        <span className={styles.arrows}>
          <button
            type="button"
            className={`${styles.arrow} pressable`}
            onClick={onPreviousWeek}
            disabled={!canGoBack}
            aria-label="Previous week"
          >
            <Icon name="chevronLeft" size={20} />
          </button>
          <button
            type="button"
            className={`${styles.arrow} pressable`}
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
          const note = day < today ? null : dayNoteFor(day);
          return (
            <button
              key={day}
              type="button"
              className={`${styles.day} pressable`}
              aria-pressed={day === selected}
              aria-label={note ? `${labels.long}: ${note}` : labels.long}
              title={note ?? undefined}
              disabled={day < today || isDisabled(day)}
              onClick={() => onSelect(day)}
            >
              <span className={styles.weekday}>{labels.weekday}</span>
              <span className={styles.date}>{labels.day}</span>
            </button>
          );
        })}
      </div>
      {notes.length > 0 && (
        <ul className={styles.notes}>
          {notes.map(({ day, note }) => (
            <li key={day} className="meta">
              {dayLabels(day).weekday} {dayLabels(day).day}: {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
