// One app_settings value, edited where it's used (each feature's admin page)
// rather than on one long settings form:
//   <SettingSwitch setting="students_can_request_venues" label="…" />
//   <SettingNumber setting="collab_max_team_size" label="…" min={2} max={51} />
//   <SettingTime setting="after_school_until" label="…" />
// A switch saves as soon as it's flipped; a number or a time saves with its button.
// Every change is written to the audit log by a database trigger.
//
// The hint (footnote) under a number or a time sits below the field and its
// Save button, not inside the field: inside, the button would line up with
// the hint instead of the box it saves.
import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Input';
import { Switch } from '@/components/Switch';
import type { AppSettings } from '@/features/settings/api';
import { useAppSettings } from '@/features/settings/hooks';
import { useUpdateSettings } from '../hooks';
import styles from '../pages/ListPage.module.css';

type BooleanSetting = {
  [K in keyof AppSettings]: AppSettings[K] extends boolean ? K : never;
}[keyof AppSettings];

type NumberSetting = {
  [K in keyof AppSettings]: AppSettings[K] extends number | null ? K : never;
}[keyof AppSettings];

/** Settings that hold a time of day ("18:00:00" in the database). */
type TimeSetting = 'after_school_until' | 'digest_time';

/** A field and its Save button side by side, with the setting's hint underneath. */
function SaveRow({
  hint,
  hintId,
  children,
}: {
  hint?: string;
  hintId: string;
  children: ReactNode;
}) {
  return (
    <div className="stack-tight">
      <div className={styles.addRow}>{children}</div>
      {hint && (
        <p id={hintId} className="meta">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Screen readers read the hint with the field, unless an error is showing (that's read instead). */
function describedBy(hintId: string, hint?: string, error?: string) {
  return hint && !error ? { 'aria-describedby': hintId } : {};
}

interface SettingSwitchProps {
  setting: BooleanSetting;
  label: string;
  hint?: string;
}

export function SettingSwitch({ setting, label, hint }: SettingSwitchProps) {
  const settings = useAppSettings();
  const save = useUpdateSettings();
  if (!settings.data) return null;
  return (
    <Switch
      label={label}
      hint={hint}
      checked={Boolean(settings.data[setting])}
      disabled={save.isPending}
      onChange={(on) => save.mutate({ [setting]: on })}
    />
  );
}

interface SettingNumberProps {
  setting: NumberSetting;
  label: string;
  hint?: string;
  min: number;
  max: number;
  /** Allow clearing the value (stored as null, e.g. "no default expiry"). */
  optional?: boolean;
}

export function SettingNumber(props: SettingNumberProps) {
  const settings = useAppSettings();
  // Shown once the database has the setting (a newer one may need its migration).
  if (!settings.data || settings.data[props.setting] === undefined) return null;
  // Keyed by the saved value, so the field resets after each save.
  const saved = settings.data[props.setting];
  return <NumberForm key={String(saved)} {...props} saved={saved} />;
}

function NumberForm({
  setting,
  label,
  hint,
  min,
  max,
  optional,
  saved,
}: SettingNumberProps & { saved: number | null }) {
  const save = useUpdateSettings();
  const hintId = useId();
  const [value, setValue] = useState(saved === null ? '' : String(saved));
  const number = Number(value);
  const empty = value.trim() === '';
  const problem =
    empty && !optional
      ? 'Enter a number.'
      : !empty && (!Number.isInteger(number) || number < min || number > max)
        ? `A whole number from ${min} to ${max}.`
        : null;
  const error =
    value !== (saved === null ? '' : String(saved)) ? (problem ?? undefined) : undefined;

  return (
    <SaveRow hint={hint} hintId={hintId}>
      <TextField
        label={label}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={error}
        {...describedBy(hintId, hint, error)}
      />
      <Button
        variant="secondary"
        disabled={Boolean(problem) || value === (saved === null ? '' : String(saved))}
        loading={save.isPending}
        onClick={() => save.mutate({ [setting]: empty ? null : number })}
      >
        Save
      </Button>
    </SaveRow>
  );
}

interface SettingTimeProps {
  setting: TimeSetting;
  label: string;
  hint?: string;
}

export function SettingTime(props: SettingTimeProps) {
  const settings = useAppSettings();
  // Shown once the database has the setting (its migration is applied).
  const saved = settings.data?.[props.setting];
  if (!saved) return null;
  return <TimeForm key={saved} {...props} saved={saved.slice(0, 5)} />;
}

function TimeForm({ setting, label, hint, saved }: SettingTimeProps & { saved: string }) {
  const save = useUpdateSettings();
  const hintId = useId();
  const [value, setValue] = useState(saved);
  return (
    <SaveRow hint={hint} hintId={hintId}>
      <TextField
        label={label}
        type="time"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        {...describedBy(hintId, hint)}
      />
      <Button
        variant="secondary"
        disabled={!value || value === saved}
        loading={save.isPending}
        onClick={() => save.mutate({ [setting]: value })}
      >
        Save
      </Button>
    </SaveRow>
  );
}
