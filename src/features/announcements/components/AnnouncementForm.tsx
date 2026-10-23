// =============================================================================
// Announcements: the create/edit form (layer 5 of 5).
//
// The form holds its own field state, validates on submit with
// validateAnnouncement(), and hands clean values to onSubmit. It doesn't know
// whether it's creating or editing: the page decides that. Teachers don't see
// the whole-school or pin options (UI hint); the database refuses them anyway.
// When the school limits teachers to their own classes (Q12), the grade and
// section chips show only what this teacher teaches; again, the database
// enforces it.
// =============================================================================
import { useState, type FormEvent } from 'react';
import { Button, ButtonLink } from '@/components/Button';
import { FilterChip } from '@/components/Chip';
import { CheckboxField, FormError, TextArea, TextField } from '@/components/Input';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useCurrentUser } from '@/features/auth/hooks';
import { useAppSettings } from '@/features/settings/hooks';
import { useActiveGrades, useClasses, useSections } from '@/features/school/hooks';
import { sectionLabel, teachableAudience } from '@/features/school/logic';
import { canPostSchoolWide } from '@/lib/permissions';
import {
  BODY_MAX,
  TITLE_MAX,
  validateAnnouncement,
  type AnnouncementErrors,
  type AnnouncementFormValues,
} from '../validation';
import styles from './AnnouncementForm.module.css';

interface AnnouncementFormProps {
  initialValues: AnnouncementFormValues;
  submitLabel: string;
  cancelTo: string;
  submitting: boolean;
  /** An error from the database, already turned into words. */
  submitError: string | null;
  onSubmit: (values: AnnouncementFormValues) => void;
}

export function AnnouncementForm({
  initialValues,
  submitLabel,
  cancelTo,
  submitting,
  submitError,
  onSubmit,
}: AnnouncementFormProps) {
  const user = useCurrentUser();
  const isAdmin = canPostSchoolWide(user);
  // The school's grades and sections (Admin > Grades and sections).
  const activeGrades = useActiveGrades();
  const allSections = useSections().data ?? [];
  const classes = useClasses().data ?? [];
  const anyGrade = useAppSettings().data?.teachers_post_any_grade ?? true;
  const limited = !isAdmin && !anyGrade;
  const teachable = teachableAudience(user.id, classes, allSections);
  const grades = limited ? teachable.grades : activeGrades;
  const sections = allSections.filter(
    (s) => activeGrades.includes(s.grade) && (!limited || teachable.sectionIds.includes(s.id)),
  );
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<AnnouncementErrors>({});

  // One small helper so each field updates just its own value.
  function update<K extends keyof AnnouncementFormValues>(
    key: K,
    value: AnnouncementFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleGrade(grade: number) {
    update(
      'grades',
      values.grades.includes(grade)
        ? values.grades.filter((g) => g !== grade)
        : [...values.grades, grade].sort((a, b) => a - b),
    );
  }

  function toggleSection(id: string) {
    update(
      'sectionIds',
      values.sectionIds.includes(id)
        ? values.sectionIds.filter((s) => s !== id)
        : [...values.sectionIds, id],
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateAnnouncement(values, user);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(values);
  }

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      <TextField
        label="Title"
        value={values.title}
        maxLength={TITLE_MAX}
        onChange={(event) => update('title', event.target.value)}
        error={errors.title}
      />
      <TextArea
        label="Message"
        rows={6}
        value={values.body}
        maxLength={BODY_MAX}
        onChange={(event) => update('body', event.target.value)}
        error={errors.body}
      />
      <TextField
        label="Post as (optional)"
        hint="Shown instead of your name, e.g. a department or club."
        value={values.postedAs}
        onChange={(event) => update('postedAs', event.target.value)}
        error={errors.postedAs}
      />

      {isAdmin ? (
        <div className="stack-tight">
          <span className={styles.legend}>Who is it for?</span>
          <SegmentedControl
            label="Who is it for?"
            value={values.audience}
            onChange={(audience) => update('audience', audience)}
            options={[
              { value: 'grades', label: 'Some grades' },
              { value: 'school', label: 'Whole school' },
            ]}
          />
        </div>
      ) : (
        <p className="meta">Teachers post to grades. Admins can post to the whole school.</p>
      )}

      {values.audience === 'grades' && (
        <fieldset
          className={styles.fieldset}
          aria-describedby={errors.grades ? 'grades-error' : undefined}
        >
          <legend className={styles.legend}>Grades</legend>
          <div className="row-wrap">
            {grades.map((grade) => (
              <FilterChip
                key={grade}
                selected={values.grades.includes(grade)}
                onClick={() => toggleGrade(grade)}
              >
                Grade {grade}
              </FilterChip>
            ))}
          </div>
          {limited && grades.length === 0 && (
            <p className="meta">You don't teach a whole grade. Choose your sections below.</p>
          )}
          {errors.grades && (
            <p id="grades-error" className={styles.error} role="alert">
              {errors.grades}
            </p>
          )}
        </fieldset>
      )}

      {values.audience === 'grades' && sections.length > 0 && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Only some sections (optional)</legend>
          <div className="row-wrap">
            {sections.map((section) => (
              <FilterChip
                key={section.id}
                selected={values.sectionIds.includes(section.id)}
                onClick={() => toggleSection(section.id)}
              >
                {sectionLabel(section)}
              </FilterChip>
            ))}
          </div>
          {values.sectionIds.length > 0 && (
            <p className="meta">Only students in these sections will see it.</p>
          )}
        </fieldset>
      )}

      {isAdmin && (
        <CheckboxField
          label="Pin to the top of everyone's feed"
          hint="Pinned announcements also notify everyone."
          checked={values.pinned}
          onChange={(event) => update('pinned', event.target.checked)}
        />
      )}
      {(errors.audience || errors.pinned) && (
        <FormError message={errors.audience ?? errors.pinned} />
      )}

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
