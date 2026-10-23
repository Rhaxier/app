// A row of mutually exclusive options in one rounded box, e.g. All / Shared / Drafts
// or the map's floor switcher G / 1 / 2. The selected option has the ink fill.
import styles from './SegmentedControl.module.css';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  /** Read by screen readers, e.g. "Floor". */
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  compact,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={[styles.group, compact && styles.compact].filter(Boolean).join(' ')}
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
          {option.label}
        </button>
      ))}
    </div>
  );
}
