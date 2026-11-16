// Edits one room's name, class or subject, teacher and type in the chosen
// term. Saving sends the term's whole list (updateAssignment changes one
// row of it), and the database checks it again (map_save_assignments).
// Clearing a name makes the room unnamed, which hides it from student
// search, so that asks first.
import { useState } from 'react';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormError, SelectField, TextField } from '@/components/Input';
import {
  checkRoomEdit,
  NAME_MAX_LENGTH,
  ROOM_TYPES,
  updateAssignment,
  type RoomRow,
} from '@/features/map/nav/assignments';
import { useSaveAssignments } from '@/features/map/nav/hooks';
import type { Assignment, RoomType } from '@/features/map/nav/types';
import { errorMessage } from '@/lib/errors';
import { footnotes } from '../../strings';
import { floorLabel, kindLabel, roomTypeLabel } from './labels';

interface RoomEditorProps {
  row: RoomRow;
  presetId: string;
  assignments: Assignment[];
  onDone: () => void;
}

export function RoomEditor({ row, presetId, assignments, onDone }: RoomEditorProps) {
  const save = useSaveAssignments();
  const [values, setValues] = useState({
    name: row.name,
    subject: row.subject,
    teacher: row.teacher,
    type: row.type,
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmUnname, setConfirmUnname] = useState(false);
  const changed =
    values.name.trim() !== row.name ||
    values.subject.trim() !== row.subject ||
    values.teacher.trim() !== row.teacher ||
    values.type !== row.type;

  function write() {
    const list = updateAssignment(assignments, row.id, {
      name: values.name.trim(),
      subject: values.subject.trim(),
      teacher: values.teacher.trim(),
      type: values.type,
    });
    save.mutate({ presetId, assignments: list }, { onSuccess: onDone });
  }

  function submit() {
    const problem = checkRoomEdit(assignments, row.id, values.name);
    setNameError(problem);
    if (problem) return;
    if (row.name !== '' && values.name.trim() === '') {
      setConfirmUnname(true);
      return;
    }
    write();
  }

  return (
    <form
      className="stack"
      aria-label={`Edit ${row.name || row.id}`}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="meta">
        {kindLabel[row.kind]} {row.id} · {floorLabel(row.floor)}
      </p>
      <TextField
        label="Name"
        placeholder={row.kind === 'entrance' ? 'Main gate' : 'PYP3 B'}
        maxLength={NAME_MAX_LENGTH}
        value={values.name}
        error={nameError ?? undefined}
        hint={row.kind === 'entrance' ? footnotes.mapRooms.entrance : footnotes.mapRooms.unnamed}
        onChange={(event) => setValues({ ...values, name: event.target.value })}
      />
      <TextField
        label="Class or subject"
        placeholder="Grade 3 B"
        value={values.subject}
        onChange={(event) => setValues({ ...values, subject: event.target.value })}
      />
      <TextField
        label="Teacher"
        placeholder="Teacher A"
        hint={footnotes.mapRooms.teacher}
        value={values.teacher}
        onChange={(event) => setValues({ ...values, teacher: event.target.value })}
      />
      <SelectField
        label="Type"
        hint={footnotes.mapRooms.type}
        value={values.type}
        onChange={(event) => setValues({ ...values, type: event.target.value as RoomType })}
      >
        {ROOM_TYPES.map((type) => (
          <option key={type} value={type}>
            {roomTypeLabel[type]}
          </option>
        ))}
      </SelectField>
      <FormError message={save.isError ? errorMessage(save.error) : null} />
      <div className="row">
        <Button type="submit" loading={save.isPending} disabled={!changed}>
          Save
        </Button>
        <Button type="button" variant="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>

      <ConfirmDialog
        open={confirmUnname}
        title={`Leave ${row.name} without a name?`}
        confirmLabel="Remove name"
        busy={save.isPending}
        error={save.isError ? errorMessage(save.error) : null}
        onConfirm={write}
        onClose={() => setConfirmUnname(false)}
      >
        <p>{footnotes.mapRooms.unnamed}</p>
      </ConfirmDialog>
    </form>
  );
}
