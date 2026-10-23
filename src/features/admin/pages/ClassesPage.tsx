// Admin > Classes: who teaches whom. A class belongs to a grade and, usually,
// one section (10 A Physics); a class with no section covers the whole grade.
//
// Classes matter for announcements (Q12): with "Teachers may post to any
// grade" switched off, a teacher may announce only to the grades and sections
// they teach here. It stays on until the school has entered its classes.
import { useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CheckboxField, FormError, SelectField, TextField } from '@/components/Input';
import { Sheet } from '@/components/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Switch } from '@/components/Switch';
import { useStaff } from '@/features/people/hooks';
import type { SchoolClass } from '@/features/school/api';
import {
  useActiveGrades,
  useClasses,
  useSaveClass,
  useSections,
  useSetClassArchived,
} from '@/features/school/hooks';
import { sectionLabel } from '@/features/school/logic';
import { useAppSettings } from '@/features/settings/hooks';
import { errorMessage } from '@/lib/errors';
import { AdminPage } from '../components/AdminPage';
import { useUpdateSettings, useUsers } from '../hooks';
import { validateClass, type ClassFormValues } from '../logic';
import styles from './ClassesPage.module.css';

export function ClassesPage() {
  const classes = useClasses();
  const sections = useSections().data ?? [];
  const grades = useActiveGrades();
  const [grade, setGrade] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  // undefined = closed, null = new class, a class = editing it.
  const [editing, setEditing] = useState<SchoolClass | null | undefined>(undefined);

  const shown = (classes.data ?? []).filter(
    (c) => (!grade || String(c.grade) === grade) && (showArchived || !c.archived_at),
  );
  const sectionName = (id: string | null) => {
    const section = sections.find((s) => s.id === id);
    return section ? sectionLabel(section) : null;
  };

  return (
    <AdminPage
      title="Classes"
      description="Who teaches whom. Used to limit who teachers can announce to."
      actions={
        <Button size="small" icon="plus" onClick={() => setEditing(null)}>
          New class
        </Button>
      }
    >
      <PostingRule />

      <div className={styles.filters}>
        <SelectField label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">All grades</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              Grade {g}
            </option>
          ))}
        </SelectField>
        <CheckboxField
          label="Show archived classes"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
      </div>

      {classes.isPending && <LoadingState />}
      {classes.isError && <ErrorState error={classes.error} onRetry={() => classes.refetch()} />}
      {classes.data && shown.length === 0 && (
        <EmptyState icon="users" title="No classes yet">
          Add the school's classes so teachers can be limited to their own.
        </EmptyState>
      )}
      <ul className="stack-tight">
        {shown.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={`${styles.item} pressable`}
              onClick={() => setEditing(c)}
            >
              <span className={styles.text}>
                <span className={styles.name}>{c.name}</span>
                <span className="meta">
                  {sectionName(c.section_id) ?? `Grade ${c.grade} (whole grade)`}
                  {c.subject ? ` · ${c.subject}` : ''} · {c.students.length}{' '}
                  {c.students.length === 1 ? 'student' : 'students'}
                </span>
                <span className="meta">
                  {c.teachers.map((t) => t.teacher?.full_name).join(', ') || 'No teacher yet'}
                </span>
              </span>
              {c.archived_at && <Badge tone="quiet">Archived</Badge>}
            </button>
          </li>
        ))}
      </ul>

      <Sheet
        open={editing !== undefined}
        title={editing ? editing.name : 'New class'}
        onClose={() => setEditing(undefined)}
      >
        {editing !== undefined && (
          <ClassEditor
            key={editing?.id ?? 'new'}
            schoolClass={editing}
            onDone={() => setEditing(undefined)}
          />
        )}
      </Sheet>
    </AdminPage>
  );
}

/** The Q12 switch: may teachers announce to grades they don't teach? */
function PostingRule() {
  const settings = useAppSettings();
  const save = useUpdateSettings();
  if (!settings.data) return null;
  return (
    <Card>
      <Switch
        label="Teachers may announce to any grade"
        hint="Turn off once classes are set up: teachers then post only to the grades and sections they teach."
        checked={settings.data.teachers_post_any_grade}
        disabled={save.isPending}
        onChange={(on) => save.mutate({ teachers_post_any_grade: on })}
      />
    </Card>
  );
}

interface ClassEditorProps {
  schoolClass: SchoolClass | null;
  onDone: () => void;
}

function ClassEditor({ schoolClass, onDone }: ClassEditorProps) {
  const grades = useActiveGrades();
  const sections = useSections().data ?? [];
  const staff = useStaff();
  const users = useUsers();
  const save = useSaveClass();
  const archive = useSetClassArchived();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [studentQuery, setStudentQuery] = useState('');
  const [values, setValues] = useState<ClassFormValues>({
    name: schoolClass?.name ?? '',
    subject: schoolClass?.subject ?? '',
    grade: schoolClass ? String(schoolClass.grade) : '',
    sectionId: schoolClass?.section_id ?? '',
    teacherIds: schoolClass?.teachers.map((t) => t.teacher_id) ?? [],
    studentIds: schoolClass?.students.map((s) => s.student_id) ?? [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ClassFormValues, string>>>({});

  const gradeSections = sections.filter((s) => String(s.grade) === values.grade);
  const sectionName = gradeSections.find((s) => s.id === values.sectionId)?.name;
  // Students offered: the class's grade (and section, if it has one).
  const q = studentQuery.trim().toLowerCase();
  const students = (users.data ?? []).filter(
    (u) =>
      u.role === 'student' &&
      !u.archived_at &&
      String(u.grade) === values.grade &&
      (!sectionName || u.section === sectionName) &&
      (!q || u.full_name.toLowerCase().includes(q)),
  );

  function toggle(key: 'teacherIds' | 'studentIds', id: string) {
    setValues((v) => ({
      ...v,
      [key]: v[key].includes(id) ? v[key].filter((x) => x !== id) : [...v[key], id],
    }));
  }

  function submit() {
    const found = validateClass(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    save.mutate(
      {
        id: schoolClass?.id ?? null,
        name: values.name,
        subject: values.subject,
        grade: Number(values.grade),
        sectionId: values.sectionId || null,
        teacherIds: values.teacherIds,
        studentIds: values.studentIds,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <>
      <TextField
        label="Name"
        placeholder="10 A Physics"
        value={values.name}
        onChange={(e) => setValues({ ...values, name: e.target.value })}
        error={errors.name}
      />
      <TextField
        label="Subject (optional)"
        value={values.subject}
        onChange={(e) => setValues({ ...values, subject: e.target.value })}
      />
      <div className={styles.twoColumns}>
        <SelectField
          label="Grade"
          value={values.grade}
          onChange={(e) =>
            setValues({ ...values, grade: e.target.value, sectionId: '', studentIds: [] })
          }
          error={errors.grade}
        >
          <option value="">Choose…</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Section"
          value={values.sectionId}
          disabled={!values.grade}
          onChange={(e) => setValues({ ...values, sectionId: e.target.value })}
        >
          <option value="">Whole grade</option>
          {gradeSections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </div>

      <fieldset className={styles.fieldset}>
        <legend className="label">Teachers</legend>
        {errors.teacherIds && <p className={styles.error}>{errors.teacherIds}</p>}
        {staff.data?.map((person) => (
          <CheckboxField
            key={person.id}
            label={person.full_name}
            checked={values.teacherIds.includes(person.id)}
            onChange={() => toggle('teacherIds', person.id)}
          />
        ))}
      </fieldset>

      {values.grade && (
        <fieldset className={styles.fieldset}>
          <legend className="label">Students ({values.studentIds.length} chosen)</legend>
          <TextField
            label="Find a student"
            type="search"
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
          />
          {students.length === 0 && <p className="meta">No students in this grade or section.</p>}
          {students.map((student) => (
            <CheckboxField
              key={student.id}
              label={student.full_name}
              hint={`Grade ${student.grade}${student.section ? ` ${student.section}` : ''}`}
              checked={values.studentIds.includes(student.id)}
              onChange={() => toggle('studentIds', student.id)}
            />
          ))}
        </fieldset>
      )}

      <FormError message={save.isError ? errorMessage(save.error) : null} />
      <Button fullWidth loading={save.isPending} onClick={submit}>
        Save class
      </Button>
      {schoolClass && (
        <Button variant="quiet" fullWidth icon="trash" onClick={() => setConfirmArchive(true)}>
          {schoolClass.archived_at ? 'Restore class' : 'Archive class'}
        </Button>
      )}

      <ConfirmDialog
        open={confirmArchive}
        title={schoolClass?.archived_at ? 'Restore this class?' : 'Archive this class?'}
        confirmLabel={schoolClass?.archived_at ? 'Restore' : 'Archive'}
        tone={schoolClass?.archived_at ? 'primary' : 'alert'}
        busy={archive.isPending}
        onClose={() => setConfirmArchive(false)}
        onConfirm={() =>
          schoolClass &&
          archive.mutate(
            { id: schoolClass.id, archived: !schoolClass.archived_at },
            { onSuccess: onDone },
          )
        }
      >
        <p>
          {schoolClass?.archived_at
            ? 'Its teachers count as teaching it again.'
            : 'Its teachers stop counting as teaching it, but the class list is kept.'}
        </p>
      </ConfirmDialog>
    </>
  );
}
