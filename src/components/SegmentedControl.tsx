// A row of mutually exclusive options in one rounded track, e.g. All / Shared
// / Drafts (design PDF page 11, "Segmented thumb"). The chosen option sits on
// a raised thumb that slides across when the choice changes.
//
// `floating` is the map's floor switch (G / 1 / 2): a glass pill floating over
// the plan, with a round primary thumb.
//
// The thumb is one element moved with CSS: every option is the same width, so
// option n starts at n × 100% of the thumb's own width. --count and --index
// tell the CSS how many there are and which is chosen.
import type { CSSProperties } from 'react';
import styles from './SegmentedControl.module.css';

interface Option<T extends string> {
  value: T;
  label: string;
  /** A small number after the label, e.g. "Shared 2". */
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  /** Read by screen readers, e.g. "Floor". */
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** As wide as its options, instead of the full width. */
  compact?: boolean;
  /** Glass pill with a round thumb, for floating over the map. */
  floating?: boolean;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  compact,
  floating,
}: SegmentedControlProps<T>) {
  const index = options.findIndex((option) => option.value === value);
  const position = { '--count': options.length, '--index': index } as CSSProperties;

  return (
    <div
      className={[styles.group, compact && styles.compact, floating && `glass ${styles.floating}`]
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label={label}
      style={position}
    >
      {index >= 0 && <span className={styles.thumb} aria-hidden="true" />}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${styles.option} pressable`}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span className={styles.count}>{option.count}</span>}
        </button>
      ))}
    </div>
  );
}
