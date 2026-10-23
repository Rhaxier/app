// The collab post form, shared by "new" and "edit". If the school requires a
// supervising teacher (app_settings.collab_requires_teacher, Q4), the picker
// becomes required; the database checks it too.
// Skills come from the school's list (Admin > Features > Collab). A missing
// one can be suggested; the post can use it while an admin reviews it.
import { useState, type FormEvent } from 'react';
import { Button, ButtonLink } from '@/components/Button';
import { FilterChip } from '@/components/Chip';
import { FormError, TextArea, TextField } from '@/components/Input';
import { TeacherSelect } from '@/features/people/TeacherSelect';
import { useAppSettings } from '@/features/settings/hooks';
import { errorMessage } from '@/lib/errors';
import { usePendingSuggestions, useSkillTags, useSuggestSkill } from '../hooks';
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
  const maxTeamSize = useAppSettings().data?.collab_max_team_size ?? 51;
  const tags = (useSkillTags().data ?? []).filter((t) => t.active).map((t) => t.name);
  const waiting = (usePendingSuggestions().data ?? []).map((s) => s.name);
  const suggest = useSuggestSkill();
  const [newSkill, setNewSkill] = useState('');

  function update(key: keyof CollabFormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateCollab(values, teacherRequired, acceptedCount, maxTeamSize);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(values);
  }

  const skills = parseSkills(values.skills);
  // Offer the list, waiting suggestions, and anything already on this post.
  const choices = [...new Set([...tags, ...waiting, ...skills])];
  const has = (skill: string) => skills.some((s) => s.toLowerCase() === skill.toLowerCase());

  function toggleSkill(skill: string) {
    const next = has(skill)
      ? skills.filter((s) => s.toLowerCase() !== skill.toLowerCase())
      : [...skills, skill];
    update('skills', next.join(', '));
  }

  function suggestSkill() {
    const name = newSkill.trim();
    if (!name) return;
    const known = choices.find((c) => c.toLowerCase() === name.toLowerCase());
    if (known) {
      // Already on the list (or already suggested): just choose it.
      if (!has(known)) toggleSkill(known);
      setNewSkill('');
      return;
    }
    suggest.mutate(name, {
      onSuccess: () => {
        update('skills', [...skills, name].join(', '));
        setNewSkill('');
      },
    });
  }

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
      <fieldset
        className={styles.fieldset}
        aria-describedby={errors.skills ? 'skills-error' : undefined}
      >
        <legend className={styles.legend}>Skills you need</legend>
        <div className="row-wrap">
          {choices.map((skill) => (
            <FilterChip key={skill} selected={has(skill)} onClick={() => toggleSkill(skill)}>
              {skill}
              {waiting.includes(skill) && !tags.includes(skill) ? ' (suggested)' : ''}
            </FilterChip>
          ))}
        </div>
        {errors.skills && (
          <p id="skills-error" className={styles.error} role="alert">
            {errors.skills}
          </p>
        )}
        <div className={styles.suggest}>
          <TextField
            label="Missing a skill? Suggest it"
            maxLength={40}
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                suggestSkill();
              }
            }}
          />
          <Button variant="secondary" loading={suggest.isPending} onClick={suggestSkill}>
            Suggest
          </Button>
        </div>
        <FormError message={suggest.isError ? errorMessage(suggest.error) : null} />
      </fieldset>
      <TextField
        label="How many students do you need?"
        type="number"
        inputMode="numeric"
        min={1}
        max={maxTeamSize - 1}
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
