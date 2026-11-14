// Chips are fully rounded. Two kinds:
// - FilterChip: a toggle button (selected = the primary fill), e.g. "All
//   skills", "This week". `glass` makes it a thin-glass chip for floating over
//   the map. Inside a ChipGroup (one choice at a time, like the skills
//   filter), the selected fill is one pill that springs from chip to chip.
// - Tag: a static label, e.g. a skill "CAD" on a collab post.
import { LayoutGroup, motion } from 'motion/react';
import { createContext, useContext, useId, type ReactNode } from 'react';
import { spring } from '@/lib/motion';
import styles from './Chip.module.css';

// Set inside a ChipGroup: its chips share one sliding pill.
const InGroup = createContext(false);

interface ChipGroupProps {
  /** Read by screen readers, e.g. "Filter by skill". */
  label: string;
  className?: string;
  children: ReactNode;
}

/** A row of FilterChips where only one is chosen at a time; the pill slides between them. */
export function ChipGroup({ label, className, children }: ChipGroupProps) {
  const id = useId();
  return (
    <LayoutGroup id={id}>
      <InGroup.Provider value={true}>
        <div className={className} role="group" aria-label={label}>
          {children}
        </div>
      </InGroup.Provider>
    </LayoutGroup>
  );
}

interface FilterChipProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Small coloured dot before the label, matching the map's pins. */
  marker?: 'room' | 'report' | 'busy';
  /** Thin glass, for chips that float over the map. */
  glass?: boolean;
}

export function FilterChip({ selected, onClick, children, marker, glass }: FilterChipProps) {
  const sliding = useContext(InGroup) && !glass;
  return (
    <button
      type="button"
      className={[
        'pressable',
        styles.chip,
        glass && `glass thin ${styles.glassChip}`,
        selected && styles.selected,
        sliding && styles.sliding,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={selected}
      onClick={onClick}
    >
      {sliding && selected && (
        <motion.span
          layoutId="chip-pill"
          className={styles.pill}
          transition={spring.indicator}
          aria-hidden="true"
        />
      )}
      {marker && <span className={`${styles.marker} ${styles[marker]}`} aria-hidden="true" />}
      <span className={styles.chipLabel}>{children}</span>
    </button>
  );
}

interface TagProps {
  /** neutral = outlined (skills); the others are soft tints. */
  tone?: 'neutral' | 'alert' | 'accent' | 'quiet';
  children: ReactNode;
}

export function Tag({ tone = 'neutral', children }: TagProps) {
  return <span className={`${styles.tag} ${styles[`tag_${tone}`]}`}>{children}</span>;
}
