// Admin > Users and roles. Roles change only through admin_set_role(), which
// writes to the audit log and refuses to remove the last admin.
import { useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Tag } from '@/components/Chip';
import { FormError, SelectField, TextField } from '@/components/Input';
import { PageHeader } from '@/components/PageHeader';
import { Sheet } from '@/components/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Switch } from '@/components/Switch';
import { useAppSettings } from '@/features/settings/hooks';
import { errorMessage } from '@/lib/errors';
import { responsibilityLabel, roleLabel } from '@/lib/status';
import { Constants } from '@/types/database';
import type { AdminUser, Responsibility, Role } from '../api';
import { useSetRole, useToggleResponsibility, useUpdateProfile, useUsers } from '../hooks';
import styles from './UsersPage.module.css';

const roles = Constants.public.Enums.user_role as readonly Role[];
const kinds = Constants.public.Enums.responsibility_kind as readonly Responsibility[];

export function UsersPage() {
  const users = useUsers();
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const shown = (users.data ?? []).filter(
    (user) =>
      !q || user.full_name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q),
  );
  const editing = users.data?.find((user) => user.id === editingId) ?? null;

  return (
    <div className="stack">
      <PageHeader back={{ to: '/admin', label: 'Admin' }} title="Users and roles" />
      <TextField
        label="Search by name or email"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {users.isPending && <LoadingState />}
      {users.isError && <ErrorState error={users.error} onRetry={() => users.refetch()} />}
      {users.data && shown.length === 0 && <EmptyState icon="users" title="No one matches" />}
      <ul className="stack-tight">
        {shown.map((user) => (
          <li key={user.id}>
            <button type="button" className={styles.user} onClick={() => setEditingId(user.id)}>
              <span className={styles.who}>
                <span className={styles.name}>{user.full_name}</span>
                <span className="meta">{user.email}</span>
                {user.grade && (
                  <span className="meta">
                    Grade {user.grade}
                    {user.section ? ` ${user.section}` : ''}
                  </span>
                )}
                {user.responsibilities.length > 0 && (
                  <span className="row-wrap">
                    {user.responsibilities.map((kind) => (
                      <Tag key={kind} tone="accent">
                        {responsibilityLabel[kind]}
                      </Tag>
                    ))}
                  </span>
                )}
              </span>
              <Badge tone={user.role === 'student' ? 'quiet' : 'good'}>
                {roleLabel[user.role]}
              </Badge>
            </button>
          </li>
        ))}
      </ul>
      {editing && <UserEditor key={editing.id} user={editing} onClose={() => setEditingId(null)} />}
    </div>
  );
}

function UserEditor({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const setRole = useSetRole();
  const updateProfile = useUpdateProfile();
  const toggle = useToggleResponsibility();
  const grades = useAppSettings().data?.grades ?? [];
  const [fullName, setFullName] = useState(user.full_name);
  const [grade, setGrade] = useState(user.grade ? String(user.grade) : '');
  const [section, setSection] = useState(user.section ?? '');
  const isStaffUser = user.role !== 'student';
  const error = setRole.error ?? updateProfile.error ?? toggle.error;

  return (
    <Sheet open title={user.full_name} onClose={onClose}>
      <p className="meta">{user.email}</p>
      <SelectField
        label="Role"
        value={user.role}
        disabled={setRole.isPending}
        onChange={(e) => setRole.mutate({ userId: user.id, role: e.target.value as Role })}
      >
        {roles.map((role) => (
          <option key={role} value={role}>
            {roleLabel[role]}
          </option>
        ))}
      </SelectField>

      <TextField label="Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <div className={styles.twoColumns}>
        <SelectField label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">None</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </SelectField>
        <TextField label="Section" value={section} onChange={(e) => setSection(e.target.value)} />
      </div>
      <Button
        variant="secondary"
        loading={updateProfile.isPending}
        onClick={() =>
          updateProfile.mutate({
            userId: user.id,
            fullName,
            grade: grade ? Number(grade) : null,
            section,
          })
        }
      >
        Save name and grade
      </Button>

      {isStaffUser ? (
        <Card className={styles.jobs}>
          <h3>Responsibilities</h3>
          {kinds.map((kind) => {
            const holds = user.responsibilities.includes(kind);
            return (
              <Switch
                key={kind}
                label={responsibilityLabel[kind]}
                checked={holds}
                disabled={toggle.isPending}
                onChange={() => toggle.mutate({ userId: user.id, kind, holds })}
              />
            );
          })}
        </Card>
      ) : (
        <p className="meta">Responsibilities are for teachers and admins.</p>
      )}
      <FormError message={error ? errorMessage(error) : null} />
    </Sheet>
  );
}
