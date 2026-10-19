// Chips are fully rounded. Two kinds:
// - FilterChip: a toggle button (selected = ink fill), e.g. "All", "This week".
// - Tag: static label, e.g. a skill "CAD" on a collab post.
import type { ReactNode } from 'react';
import styles from './Chip.module.css';

interface FilterChipProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Small coloured dot or square before the label, as in the map legend. */
  marker?: 'room' | 'report' | 'busy';
}

export function FilterChip({ selected, onClick, children, marker }: FilterChipProps) {
  return (
    <button
      type="button"
      className={[styles.chip, selected && styles.selected].filter(Boolean).join(' ')}
      aria-pressed={selected}
      onClick={onClick}
    >
      {marker && <span className={`${styles.marker} ${styles[marker]}`} aria-hidden="true" />}
      {children}
    </button>
  );
}

interface TagProps {
  tone?: 'alert' | 'accent' | 'quiet';
  children: ReactNode;
}

export function Tag({ tone = 'alert', children }: TagProps) {
  return <span className={`${styles.tag} ${styles[`tag_${tone}`]}`}>{children}</span>;
}
