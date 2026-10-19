// An on/off switch: a real checkbox (so keyboards and screen readers work)
// styled as a sliding toggle.
import { useId } from 'react';
import styles from './Switch.module.css';

interface SwitchProps {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function Switch({ label, hint, checked, disabled, onChange }: SwitchProps) {
  const id = useId();
  return (
    <div className={styles.row}>
      <label htmlFor={id} className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint && <span className="meta">{hint}</span>}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className={styles.switch}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}
