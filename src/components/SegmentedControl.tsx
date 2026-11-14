// A row of mutually exclusive options in one rounded track, e.g. All / Shared
// / Drafts (design PDF page 11, "Segmented thumb"). The chosen option sits on
// a raised thumb that slides across when the choice changes.
//
// `floating` is the map's floor switch (G / 1 / 2): a glass pill floating over
// the plan, with a round primary thumb.
//
// The thumb is one element shared between the options (Motion's layoutId,
// scoped to this control by LayoutGroup), so it springs from the old choice
// to the new one. With reduced motion it simply jumps.
import { LayoutGroup, motion } from 'motion/react';
import { useId } from 'react';
import { spring } from '@/lib/motion';
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
  const group = useId();

  return (
    <LayoutGroup id={group}>
      <div
        className={[styles.group, compact && styles.compact, floating && `glass ${styles.floating}`]
          .filter(Boolean)
          .join(' ')}
        role="group"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.option} pressable`}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.value === value && (
              <motion.span
                layoutId="thumb"
                className={styles.thumb}
                transition={spring.indicator}
                aria-hidden="true"
              />
            )}
            <span className={styles.optionLabel}>
              {option.label}
              {option.count !== undefined && <span className={styles.count}>{option.count}</span>}
            </span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}
