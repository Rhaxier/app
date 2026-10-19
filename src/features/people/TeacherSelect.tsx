// A dropdown of teachers and admins, used wherever someone picks a teacher.
import { SelectField } from '@/components/Input';
import { useStaff } from './hooks';

interface TeacherSelectProps {
  label: string;
  value: string;
  onChange: (teacherId: string) => void;
  error?: string;
  hint?: string;
  /** Teachers to leave out, e.g. ones a project is already shared with. */
  exclude?: string[];
}

export function TeacherSelect({
  label,
  value,
  onChange,
  error,
  hint,
  exclude = [],
}: TeacherSelectProps) {
  const staff = useStaff();
  return (
    <SelectField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={hint}
    >
      <option value="">{staff.isPending ? 'Loading…' : 'Choose a teacher…'}</option>
      {staff.data
        ?.filter((person) => !exclude.includes(person.id))
        .map((person) => (
          <option key={person.id} value={person.id}>
            {person.full_name}
          </option>
        ))}
    </SelectField>
  );
}
