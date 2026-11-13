// Chips are fully rounded. Two kinds:
// - FilterChip: a toggle button (selected = the primary fill), e.g. "All
//   skills", "This week". `glass` makes it a thin-glass chip for floating over
//   the map.
// - Tag: a static label, e.g. a skill "CAD" on a collab post.
import type { ReactNode } from 'react';
import styles from './Chip.module.css';

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
  return (
    <button
      type="button"
      className={[
        'pressable',
        styles.chip,
        glass && `glass thin ${styles.glassChip}`,
        selected && styles.selected,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={selected}
      onClick={onClick}
    >
      {marker && <span className={`${styles.marker} ${styles[marker]}`} aria-hidden="true" />}
      {children}
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
