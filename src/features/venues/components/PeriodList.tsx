// The chosen date's periods (reference screen 4, by period): each one's name
// and times, then available, booked (grey), pending approval (orange), closed
// (a holiday or blackout), past, or your selection (teal outline). Free
// periods are buttons; tap neighbouring ones to book several in a row.
import { formatTime, formatTimeRange } from '@/lib/dates';
import { runLabel, type Slot, type SlotState } from '../logic';
import styles from './PeriodList.module.css';

interface PeriodListProps {
  slots: Slot[];
  states: SlotState[];
  onToggle: (index: number) => void;
}

export function PeriodList({ slots, states, onToggle }: PeriodListProps) {
  const firstSelected = states.findIndex((state) => state.kind === 'selected');
  const lastSelected = states.map((state) => state.kind).lastIndexOf('selected');

  return (
    <ol className={styles.list} aria-label="Periods">
      {slots.map((slot, index) => {
        const state = states[index];
        const range = formatTimeRange(slot.start, slot.end);
        return (
          <li key={slot.index} className={styles.row}>
            <span className={styles.period}>
              <span className={styles.name}>{slot.name}</span>
              <span className={styles.time}>{range}</span>
            </span>
            {state.kind === 'booked' && (
              <div className={`${styles.block} ${styles.booked}`}>
                <span className={styles.blockTitle}>{state.booking.title}</span>
                <span className={styles.blockMeta}>
                  Booked · until {formatTime(state.booking.ends_at)}
                </span>
              </div>
            )}
            {state.kind === 'waiting' && (
              <div className={`${styles.block} ${styles.waiting}`}>
                <span className={styles.blockTitle}>{state.booking.title}</span>
                <span className={styles.blockMeta}>
                  {state.booking.status === 'awaiting_teacher'
                    ? 'Awaiting teacher'
                    : 'Pending approval'}
                </span>
              </div>
            )}
            {state.kind === 'closed' && <span className={styles.muted}>Not bookable</span>}
            {state.kind === 'past' && <span className={styles.muted}>Past</span>}
            {(state.kind === 'available' || state.kind === 'selected') && (
              <button
                type="button"
                className={
                  state.kind === 'selected'
                    ? `${styles.block} ${styles.selected} pressable`
                    : `${styles.free} pressable`
                }
                aria-pressed={state.kind === 'selected'}
                aria-label={`${slot.name}, ${range}, ${state.kind === 'selected' ? 'selected' : 'available'}`}
                onClick={() => onToggle(index)}
              >
                {state.kind === 'selected'
                  ? index === firstSelected && (
                      <>
                        <span className={styles.blockTitle}>Your selection</span>
                        <span className={styles.blockMeta}>
                          {runLabel(slots, { first: firstSelected, last: lastSelected })} ·{' '}
                          {formatTimeRange(slots[firstSelected].start, slots[lastSelected].end)}
                        </span>
                      </>
                    )
                  : 'Available'}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
