// Admin > Grades and sections (Q25). The grades the school uses, and the
// sections in each (10 A, 10 B…). Grades are archived rather than deleted:
// students and history refer to them. Pickers across the app read this list.
import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { FormError, TextField } from '@/components/Input';
import { ErrorState, LoadingState } from '@/components/States';
import { Switch } from '@/components/Switch';
import type { Grade, Section } from '@/features/school/api';
import {
  useAddSection,
  useDeleteSection,
  useGrades,
  useSaveGrade,
  useSections,
} from '@/features/school/hooks';
import { sectionLabel } from '@/features/school/logic';
import { errorMessage } from '@/lib/errors';
import { AdminPage } from '../components/AdminPage';
import { footnotes, pageIntros } from '../strings';
import { validateGrade, validateSectionName } from '../logic';
import styles from './ListPage.module.css';

export function GradesPage() {
  const grades = useGrades();
  const sections = useSections();
  const [removing, setRemoving] = useState<Section | null>(null);
  const remove = useDeleteSection();

  return (
    <AdminPage title="Grades and sections" description={pageIntros.grades}>
      {(grades.isPending || sections.isPending) && <LoadingState />}
      {grades.isError && <ErrorState error={grades.error} onRetry={() => grades.refetch()} />}
      {grades.data &&
        grades.data.map((grade) => (
          <GradeCard
            key={grade.id}
            grade={grade}
            sections={(sections.data ?? []).filter((s) => s.grade === grade.grade)}
            onRemoveSection={setRemoving}
          />
        ))}
      {grades.data && <NewGrade existing={grades.data.map((g) => g.grade)} />}

      <ConfirmDialog
        open={removing !== null}
        title={`Remove section ${removing ? sectionLabel(removing) : ''}?`}
        confirmLabel="Remove section"
        busy={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })
        }
      >
        <p>
          Students keep the letter on their profile, but it won't be offered any more, and
          announcements sent only to this section won't reach anyone new.
        </p>
      </ConfirmDialog>
    </AdminPage>
  );
}

interface GradeCardProps {
  grade: Grade;
  sections: Section[];
  onRemoveSection: (section: Section) => void;
}

function GradeCard({ grade, sections, onRemoveSection }: GradeCardProps) {
  const save = useSaveGrade();
  const add = useAddSection();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function addSection(event: FormEvent) {
    event.preventDefault();
    const problem = validateSectionName(
      name,
      sections.map((s) => s.name),
    );
    setError(problem);
    if (!problem) add.mutate({ grade: grade.grade, name }, { onSuccess: () => setName('') });
  }

  return (
    <Card as="section" className="stack-tight" aria-label={grade.name}>
      <div className={styles.row}>
        <h2 className={styles.cardTitle}>{grade.name}</h2>
        {!grade.active && <Badge tone="quiet">Archived</Badge>}
      </div>
      <Switch
        label="In use"
        hint={footnotes.grades.inUse}
        checked={grade.active}
        disabled={save.isPending}
        onChange={(active) =>
          save.mutate({ id: grade.id, fields: { grade: grade.grade, name: grade.name, active } })
        }
      />
      <p className="label">Sections</p>
      {sections.length === 0 ? (
        <p className="meta">No sections: the grade is one group.</p>
      ) : (
        <ul className="row-wrap">
          {sections.map((section) => (
            <li key={section.id} className={styles.pill}>
              {sectionLabel(section)}
              <button
                type="button"
                className={styles.pillRemove}
                aria-label={`Remove section ${sectionLabel(section)}`}
                onClick={() => onRemoveSection(section)}
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className={styles.addRow} onSubmit={addSection} noValidate>
        <TextField
          label="Add a section"
          placeholder="C"
          maxLength={10}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error ?? undefined}
        />
        <Button type="submit" variant="secondary" loading={add.isPending}>
          Add
        </Button>
      </form>
    </Card>
  );
}

function NewGrade({ existing }: { existing: number[] }) {
  const save = useSaveGrade();
  const [grade, setGrade] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validateGrade(grade, existing);
    setError(problem);
    if (problem) return;
    const number = Number(grade);
    save.mutate(
      { id: null, fields: { grade: number, name: `Grade ${number}`, active: true } },
      { onSuccess: () => setGrade('') },
    );
  }

  return (
    <Card as="section" className="stack-tight" aria-label="Add a grade">
      <h2 className={styles.cardTitle}>Add a grade</h2>
      <form className={styles.addRow} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Grade number"
          type="number"
          inputMode="numeric"
          min={1}
          max={13}
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          error={error ?? undefined}
        />
        <Button type="submit" variant="secondary" loading={save.isPending}>
          Add
        </Button>
      </form>
      <FormError message={save.isError ? errorMessage(save.error) : null} />
    </Card>
  );
}
