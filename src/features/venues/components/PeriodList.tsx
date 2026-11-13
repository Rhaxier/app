// The chosen date's periods (reference screen 4; design PDF page 7, "Periods,
// not slots"): each period's name and start time, then its state: available
// (a "+" to add it), booked (hatched), pending approval (yellow), closed (a
// holiday or blackout), past, or your selection. Neighbouring selected
// periods join into one blue block, "your run". Gaps between periods show as
// a quiet "Break" line. Free periods are buttons; tap neighbouring ones to
// book several in a row.
import { Fragment } from 'react';
import { Badge } from '@/components/Badge';
import { Icon } from '@/components/Icon';
import { formatTime, formatTimeRange } from '@/lib/dates';
import { runLabel, type Slot, type SlotState } from '../logic';
import styles from './PeriodList.module.css';

interface PeriodListProps {
  slots: Slot[];
  states: SlotState[];
  onToggle: (index: number) => void;
  /** The day, for the column heading, e.g. "Tuesday 20 October". */
  dayLabel?: string;
}

/** A gap of five minutes or more between periods is a break. */
const BREAK_MS = 5 * 60_000;

export function PeriodList({ slots, states, onToggle, dayLabel }: PeriodListProps) {
  const firstSelected = states.findIndex((state) => state.kind === 'selected');
  const lastSelected = states.map((state) => state.kind).lastIndexOf('selected');

  return (
    <div className={styles.wrap}>
      <div className={styles.heading} aria-hidden="true">
        <span>Period</span>
        <span>Start</span>
        <span>{dayLabel}</span>
      </div>
      <ol className={styles.list} aria-label="Periods">
        {slots.map((slot, index) => {
          const state = states[index];
          const range = formatTimeRange(slot.start, slot.end);
          const previous = slots[index - 1];
          const isBreak = previous && slot.start.getTime() - previous.end.getTime() >= BREAK_MS;
          const selected = state.kind === 'selected';
          const rowClass = [
            styles.row,
            selected && styles.inRun,
            selected && index === firstSelected && styles.runStart,
            selected && index === lastSelected && styles.runEnd,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <Fragment key={slot.index}>
              {isBreak && (
                <li className={styles.break} aria-hidden="true">
                  Break
                </li>
              )}
              <li className={rowClass}>
                <span className={styles.name}>{slot.name}</span>
                <span className={styles.time}>{formatTime(slot.start)}</span>
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
                    <Badge tone="attention">
                      {state.booking.status === 'awaiting_teacher'
                        ? 'Awaiting teacher'
                        : 'Pending approval'}
                    </Badge>
                  </div>
                )}
                {state.kind === 'closed' && <span className={styles.muted}>Not bookable</span>}
                {state.kind === 'past' && <span className={styles.muted}>Past</span>}
                {(state.kind === 'available' || selected) && (
                  <button
                    type="button"
                    className={
                      selected
                        ? `${styles.block} ${styles.selected} pressable`
                        : `${styles.free} pressable`
                    }
                    aria-pressed={selected}
                    aria-label={`${slot.name}, ${range}, ${selected ? 'selected' : 'available'}`}
                    onClick={() => onToggle(index)}
                  >
                    {selected ? (
                      index === firstSelected && (
                        <>
                          <span className={styles.blockTitle}>
                            Your selection
                            <Icon name="check" size={16} />
                          </span>
                          <span className={styles.blockMeta}>
                            {runLabel(slots, { first: firstSelected, last: lastSelected })} ·{' '}
                            {formatTimeRange(slots[firstSelected].start, slots[lastSelected].end)}
                          </span>
                        </>
                      )
                    ) : (
                      <>
                        Available
                        <span className={styles.add} aria-hidden="true">
                          <Icon name="plus" size={14} />
                        </span>
                      </>
                    )}
                  </button>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}
