// The project form, shared by "new" and "edit". Validation is in logic.ts.
import { useState, type FormEvent } from 'react';
import { Button, ButtonLink } from '@/components/Button';
import { FormError, TextArea, TextField } from '@/components/Input';
import { validateProject, type ProjectFormErrors, type ProjectFormValues } from '../logic';
import styles from './ProjectForm.module.css';

interface ProjectFormProps {
  initialValues: ProjectFormValues;
  submitLabel: string;
  cancelTo: string;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (values: ProjectFormValues) => void;
}

export function ProjectForm({
  initialValues,
  submitLabel,
  cancelTo,
  submitting,
  submitError,
  onSubmit,
}: ProjectFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<ProjectFormErrors>({});

  function update(key: keyof ProjectFormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateProject(values);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(values);
  }

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      <TextField
        label="Title"
        value={values.title}
        onChange={(e) => update('title', e.target.value)}
        error={errors.title}
      />
      <TextField
        label="Subject (optional)"
        placeholder="e.g. Physics"
        value={values.subject}
        onChange={(e) => update('subject', e.target.value)}
        error={errors.subject}
      />
      <TextArea
        label="Description"
        rows={5}
        value={values.description}
        onChange={(e) => update('description', e.target.value)}
      />
      <TextField
        label="Link (optional)"
        type="url"
        placeholder="https://"
        hint="A shared document, video or repository."
        value={values.linkUrl}
        onChange={(e) => update('linkUrl', e.target.value)}
        error={errors.linkUrl}
      />
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
