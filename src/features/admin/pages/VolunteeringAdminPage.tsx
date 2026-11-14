// Admin > Features > Volunteering. Whether student events need a teacher's
// approval, the categories events are filtered by (Q27), and the SUPW hours
// each grade should reach (students see their progress on the Volunteer tab).
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/Input';
import { LoadingState } from '@/components/States';
import { useActiveGrades } from '@/features/school/hooks';
import {
  useSaveCategory,
  useSetSupwTarget,
  useSupwTargets,
  useVolunteerCategories,
} from '@/features/volunteering/hooks';
import { AdminPage } from '../components/AdminPage';
import { footnotes, pageIntros } from '../strings';
import { NameListEditor } from '../components/NameListEditor';
import { SettingSwitch } from '../components/SettingControls';
import styles from './ListPage.module.css';

export function VolunteeringAdminPage() {
  const categories = useVolunteerCategories();
  const saveCategory = useSaveCategory();

  return (
    <AdminPage title="Volunteering" description={pageIntros.volunteering}>
      <Card className="stack-tight">
        <SettingSwitch
          setting="student_events_need_approval"
          label="Student events need a teacher's approval"
          hint={footnotes.volunteering.studentApproval}
        />
      </Card>

      <Card className="stack-tight">
        <h2 className={styles.cardTitle}>Categories</h2>
        <p className="meta">{footnotes.volunteering.categories}</p>
        {categories.isPending && <LoadingState shape="row" />}
        {categories.data && (
          <NameListEditor
            noun="category"
            items={categories.data}
            busy={saveCategory.isPending}
            onAdd={(name) =>
              saveCategory.mutate({
                id: null,
                fields: { name, active: true, sort_order: categories.data.length + 1 },
              })
            }
            onRename={(c, name) =>
              saveCategory.mutate({
                id: c.id,
                fields: {
                  name,
                  active: c.active,
                  sort_order: categories.data.find((x) => x.id === c.id)?.sort_order ?? 0,
                },
              })
            }
            onSetActive={(c, active) =>
              saveCategory.mutate({
                id: c.id,
                fields: {
                  name: c.name,
                  active,
                  sort_order: categories.data.find((x) => x.id === c.id)?.sort_order ?? 0,
                },
              })
            }
          />
        )}
      </Card>

      <SupwTargets />
    </AdminPage>
  );
}

function SupwTargets() {
  const grades = useActiveGrades();
  const targets = useSupwTargets();
  return (
    <Card className="stack-tight">
      <h2 className={styles.cardTitle}>SUPW hours target by grade</h2>
      <p className="meta">{footnotes.volunteering.targets}</p>
      {targets.isPending && <LoadingState shape="row" />}
      {targets.data &&
        grades.map((grade) => (
          <TargetRow
            key={`${grade}-${targets.data.find((t) => t.grade === grade)?.hours ?? ''}`}
            grade={grade}
            saved={targets.data.find((t) => t.grade === grade)?.hours ?? null}
          />
        ))}
    </Card>
  );
}

function TargetRow({ grade, saved }: { grade: number; saved: number | null }) {
  const save = useSetSupwTarget();
  const [value, setValue] = useState(saved === null ? '' : String(saved));
  const hours = Number(value);
  const valid = value.trim() === '' || (hours > 0 && hours <= 9999);
  const changed = value !== (saved === null ? '' : String(saved));
  return (
    <div className={styles.addRow}>
      <TextField
        label={`Grade ${grade} (hours)`}
        type="number"
        min={0}
        step={0.5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={valid ? undefined : 'A number of hours above 0.'}
      />
      <Button
        variant="secondary"
        disabled={!changed || !valid}
        loading={save.isPending}
        onClick={() => save.mutate({ grade, hours: value.trim() === '' ? null : hours })}
      >
        Save
      </Button>
    </div>
  );
}
