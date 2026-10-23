// The day's time slots (reference screen 4): available, booked (grey),
// pending approval (orange) and your selection (teal outline). Free slots
// are buttons; tap neighbouring ones to book a longer block.
import { formatTime, formatTimeRange } from '@/lib/dates';
import type { Slot, SlotState } from '../logic';
import styles from './SlotList.module.css';

interface SlotListProps {
  slots: Slot[];
  states: SlotState[];
  onToggle: (index: number) => void;
}

export function SlotList({ slots, states, onToggle }: SlotListProps) {
  const firstSelected = states.findIndex((state) => state.kind === 'selected');
  const lastSelected = states.map((state) => state.kind).lastIndexOf('selected');

  return (
    <ol className={styles.list} aria-label="Time slots">
      {slots.map((slot, index) => {
        const state = states[index];
        const time = formatTime(slot.start);
        const range = formatTimeRange(slot.start, slot.end);
        return (
          <li key={slot.index} className={styles.row}>
            <span className={styles.time}>{time}</span>
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
                aria-label={`${range}, ${state.kind === 'selected' ? 'selected' : 'available'}`}
                onClick={() => onToggle(index)}
              >
                {state.kind === 'selected' ? (
                  <>
                    <span className={styles.blockTitle}>
                      {index === firstSelected ? 'Your selection' : ''}
                    </span>
                    {index === firstSelected && (
                      <span className={styles.selectedRange}>
                        {formatTimeRange(slots[firstSelected].start, slots[lastSelected].end)}
                      </span>
                    )}
                  </>
                ) : (
                  'Available'
                )}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
