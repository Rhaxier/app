// Create / edit a volunteering event and its roles. Validation is in
// logic.ts (validateEvent); the database repeats every rule.
import { useState, type FormEvent } from 'react';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckboxField, FormError, SelectField, TextArea, TextField } from '@/components/Input';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useRooms } from '@/features/map/hooks';
import {
  emptyRole,
  hasErrors,
  validateEvent,
  type EventFormErrors,
  type EventFormValues,
  type RoleFormValues,
} from '../logic';
import styles from './EventForm.module.css';

interface EventFormProps {
  initialValues: EventFormValues;
  submitLabel: string;
  cancelTo: string;
  submitting: boolean;
  submitError: string | null;
  /** Shown to students: their event needs a teacher's approval. */
  needsApproval: boolean;
  onSubmit: (values: EventFormValues, removedRoleIds: string[]) => void;
}

export function EventForm({
  initialValues,
  submitLabel,
  cancelTo,
  submitting,
  submitError,
  needsApproval,
  onSubmit,
}: EventFormProps) {
  const rooms = useRooms();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [removedRoleIds, setRemovedRoleIds] = useState<string[]>([]);

  function update<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateRole(index: number, changes: Partial<RoleFormValues>) {
    update(
      'roles',
      values.roles.map((role, i) => (i === index ? { ...role, ...changes } : role)),
    );
  }

  function removeRole(index: number) {
    const role = values.roles[index];
    if (role.id) setRemovedRoleIds((ids) => [...ids, role.id!]);
    update(
      'roles',
      values.roles.filter((_, i) => i !== index),
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateEvent(values);
    setErrors(found);
    if (!hasErrors(found)) onSubmit(values, removedRoleIds);
  }

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      {needsApproval && (
        <p className={styles.notice}>
          A teacher checks student events before anyone else can see them.
        </p>
      )}
      <TextField
        label="Title"
        value={values.title}
        onChange={(e) => update('title', e.target.value)}
        error={errors.title}
      />
      <TextField
        label="Organised by (optional)"
        hint="A club or group name, shown instead of yours."
        value={values.organiserLabel}
        onChange={(e) => update('organiserLabel', e.target.value)}
      />
      <TextArea
        label="What's it about?"
        rows={4}
        value={values.description}
        onChange={(e) => update('description', e.target.value)}
      />
      <div className={styles.twoColumns}>
        <TextField
          label="Starts"
          type="datetime-local"
          value={values.startsAt}
          onChange={(e) => update('startsAt', e.target.value)}
          error={errors.startsAt}
        />
        <TextField
          label="Ends"
          type="datetime-local"
          value={values.endsAt}
          onChange={(e) => update('endsAt', e.target.value)}
          error={errors.endsAt}
        />
      </div>

      <div className="stack-tight">
        <span className={styles.legend}>Where</span>
        <SegmentedControl
          label="Where"
          value={values.placeKind}
          onChange={(placeKind) => update('placeKind', placeKind)}
          options={[
            { value: 'room', label: 'A room at school' },
            { value: 'text', label: 'Somewhere else' },
          ]}
        />
        {values.placeKind === 'room' ? (
          <SelectField
            label="Room"
            value={values.roomId}
            onChange={(e) => update('roomId', e.target.value)}
            error={errors.place}
          >
            <option value="">Choose a room…</option>
            {rooms.data?.map((room) => (
              <option key={room.id} value={room.id}>
                {room.code} · {room.name}
              </option>
            ))}
          </SelectField>
        ) : (
          <TextField
            label="Place"
            value={values.placeText}
            onChange={(e) => update('placeText', e.target.value)}
            error={errors.place}
          />
        )}
      </div>

      <div className={styles.twoColumns}>
        <TextField
          label="SUPW hours"
          type="number"
          inputMode="decimal"
          min={0}
          step={0.5}
          value={values.supwHours}
          onChange={(e) => update('supwHours', e.target.value)}
          error={errors.supwHours}
        />
        <TextField
          label="Sign up by (optional)"
          type="datetime-local"
          value={values.signupDeadline}
          onChange={(e) => update('signupDeadline', e.target.value)}
          error={errors.signupDeadline}
        />
      </div>
      <CheckboxField
        label="Students may sign up for more than one role"
        checked={values.allowMultipleRoles}
        onChange={(e) => update('allowMultipleRoles', e.target.checked)}
      />

      <fieldset className={styles.roles}>
        <legend className={styles.legend}>Roles</legend>
        <p className="meta">Each role says how many students it needs. You choose who fills it.</p>
        {values.roles.map((role, index) => {
          const roleError = errors.roleErrors?.[index] ?? {};
          return (
            <Card key={role.id ?? `new-${index}`} className={styles.role}>
              <div className={styles.roleTop}>
                <TextField
                  label={`Role ${index + 1}`}
                  placeholder="e.g. Registration desk"
                  value={role.name}
                  onChange={(e) => updateRole(index, { name: e.target.value })}
                  error={roleError.name}
                />
                <TextField
                  label="Students"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className={styles.spots}
                  value={role.spotsWanted}
                  onChange={(e) => updateRole(index, { spotsWanted: e.target.value })}
                  error={roleError.spotsWanted}
                />
              </div>
              <TextField
                label="What it involves (optional)"
                value={role.description}
                onChange={(e) => updateRole(index, { description: e.target.value })}
              />
              {values.roles.length > 1 && (
                <Button
                  variant="ghost"
                  size="small"
                  icon="trash"
                  disabled={role.locked}
                  onClick={() => removeRole(index)}
                >
                  {role.locked ? 'Has selected students' : 'Remove role'}
                </Button>
              )}
            </Card>
          );
        })}
        <FormError message={errors.roles} />
        <Button
          variant="secondary"
          icon="plus"
          onClick={() => update('roles', [...values.roles, { ...emptyRole }])}
        >
          Add a role
        </Button>
      </fieldset>

      <FormError message={submitError} />
      <div className={styles.actions}>
        <ButtonLink to={cancelTo} variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
