// The collab post form, shared by "new" and "edit". If the school requires a
// supervising teacher (app_settings.collab_requires_teacher, Q4), the picker
// becomes required; the database checks it too.
import { useState, type FormEvent } from 'react';
import { Button, ButtonLink } from '@/components/Button';
import { Tag } from '@/components/Chip';
import { FormError, TextArea, TextField } from '@/components/Input';
import { TeacherSelect } from '@/features/people/TeacherSelect';
import {
  parseSkills,
  validateCollab,
  type CollabFormErrors,
  type CollabFormValues,
} from '../logic';
import styles from './CollabForm.module.css';

interface CollabFormProps {
  initialValues: CollabFormValues;
  teacherRequired: boolean;
  acceptedCount?: number;
  submitLabel: string;
  cancelTo: string;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (values: CollabFormValues) => void;
}

export function CollabForm({
  initialValues,
  teacherRequired,
  acceptedCount = 0,
  submitLabel,
  cancelTo,
  submitting,
  submitError,
  onSubmit,
}: CollabFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<CollabFormErrors>({});

  function update(key: keyof CollabFormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateCollab(values, teacherRequired, acceptedCount);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(values);
  }

  const skills = parseSkills(values.skills);

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      <TextField
        label="What are you making?"
        value={values.title}
        onChange={(e) => update('title', e.target.value)}
        error={errors.title}
      />
      <TextArea
        label="Tell people more"
        rows={4}
        value={values.description}
        onChange={(e) => update('description', e.target.value)}
      />
      <TextField
        label="Skills you need"
        hint="Separate them with commas, e.g. CAD, Soldering, Writing"
        value={values.skills}
        onChange={(e) => update('skills', e.target.value)}
        error={errors.skills}
      />
      {skills.length > 0 && (
        <div className="row-wrap" aria-label="Skills preview">
          {skills.map((skill) => (
            <Tag key={skill}>{skill}</Tag>
          ))}
        </div>
      )}
      <TextField
        label="How many students do you need?"
        type="number"
        inputMode="numeric"
        min={1}
        max={50}
        value={values.spotsWanted}
        onChange={(e) => update('spotsWanted', e.target.value)}
        error={errors.spotsWanted}
        hint="When this many are accepted, the post closes to new requests."
      />
      <TeacherSelect
        label={teacherRequired ? 'Supervising teacher' : 'Supervising teacher (optional)'}
        value={values.supervisingTeacherId}
        onChange={(teacherId) => update('supervisingTeacherId', teacherId)}
        error={errors.supervisingTeacherId}
      />
      <p className="meta">Teachers and admins can see every post and its requests.</p>
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
