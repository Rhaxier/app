// Form fields. Each one renders a real <label> tied to its input, plus an
// optional hint and error message that screen readers announce with the field.
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import styles from './Input.module.css';

interface FieldFrameProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

// Shared wrapper: label above, field, then hint or error below.
function FieldFrame({ id, label, hint, error, children }: FieldFrameProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className={styles.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

// aria-describedby points at whichever message is showing.
function describedBy(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({ label, hint, error, id, className, ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error}>
      <input
        id={fieldId}
        className={[styles.input, className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...rest}
      />
    </FieldFrame>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextArea({ label, hint, error, id, rows = 4, ...rest }: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error}>
      <textarea
        id={fieldId}
        rows={rows}
        className={`${styles.input} ${styles.textarea}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...rest}
      />
    </FieldFrame>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function SelectField({ label, hint, error, id, children, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error}>
      <select
        id={fieldId}
        className={`${styles.input} ${styles.select}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...rest}
      >
        {children}
      </select>
    </FieldFrame>
  );
}

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
}

export function CheckboxField({ label, hint, id, ...rest }: CheckboxFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={styles.checkboxRow}>
      <input id={fieldId} type="checkbox" className={styles.checkbox} {...rest} />
      <label htmlFor={fieldId}>
        <span className={styles.checkboxLabel}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </label>
    </div>
  );
}

/** A form-level error, shown above the submit button. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className={styles.formError} role="alert">
      {message}
    </p>
  );
}
