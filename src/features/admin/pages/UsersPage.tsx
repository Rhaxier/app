// Admin > Users. Find anyone by name, email, role or grade, then change their
// role, grade and section, responsibilities, or pause their posting.
// Roles change only through admin_set_role() (audited, refuses to remove the
// last admin); suspensions through admin_suspend_posting().
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Tag } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FieldRow, FormError, SelectField, TextField } from '@/components/Input';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Sheet } from '@/components/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Switch } from '@/components/Switch';
import { useActiveGrades, useSections } from '@/features/school/hooks';
import { formatDateTime, fromDateTimeInputValue, toDateTimeInputValue } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { responsibilityLabel, roleLabel } from '@/lib/status';
import { Constants } from '@/types/database';
import type { AdminUser, Responsibility, Role } from '../api';
import { AdminPage } from '../components/AdminPage';
import {
  useLiftSuspension,
  useSetRole,
  useSuspendPosting,
  useToggleResponsibility,
  useUpdateProfile,
  useUsers,
} from '../hooks';
import { filterUsers, noUserFilters, type UserFilters } from '../logic';
import styles from './UsersPage.module.css';

const roles = Constants.public.Enums.user_role as readonly Role[];
const kinds = Constants.public.Enums.responsibility_kind as readonly Responsibility[];

export function UsersPage() {
  const users = useUsers();
  const grades = useActiveGrades();
  const [filters, setFilters] = useState<UserFilters>(noUserFilters);
  // ?open=<id> opens that person straight away (e.g. "Suspend the author" in Moderation).
  const [searchParams] = useSearchParams();
  const [editingId, setEditingId] = useState<string | null>(searchParams.get('open'));

  const shown = filterUsers(users.data ?? [], filters);
  const editing = users.data?.find((user) => user.id === editingId) ?? null;
  const set = (changes: Partial<UserFilters>) => setFilters((f) => ({ ...f, ...changes }));

  return (
    <AdminPage title="Users" description="Roles, grades, responsibilities and posting.">
      <TextField
        label="Search by name or email"
        type="search"
        value={filters.query}
        onChange={(e) => set({ query: e.target.value })}
      />
      <SegmentedControl
        label="Role"
        value={filters.role}
        onChange={(role) => set({ role })}
        options={[
          { value: 'all', label: 'Everyone' },
          { value: 'student', label: 'Students' },
          { value: 'teacher', label: 'Teachers' },
          { value: 'admin', label: 'Admins' },
        ]}
      />
      <FieldRow>
        <SelectField
          label="Grade"
          value={filters.grade}
          onChange={(e) => set({ grade: e.target.value })}
        >
          <option value="">Any grade</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              Grade {g}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Status"
          value={filters.status}
          onChange={(e) => set({ status: e.target.value as UserFilters['status'] })}
        >
          <option value="current">Current</option>
          <option value="suspended">Posting paused</option>
          <option value="archived">Left (archived)</option>
          <option value="all">Everyone</option>
        </SelectField>
      </FieldRow>

      {users.isPending && <LoadingState shape="row" count={6} />}
      {users.isError && <ErrorState error={users.error} onRetry={() => users.refetch()} />}
      {users.data && (
        <p className="meta" aria-live="polite">
          {shown.length} of {users.data.length} people
        </p>
      )}
      {users.data && shown.length === 0 && <EmptyState icon="users" title="No one matches" />}
      <ul className="stack-tight">
        {shown.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              className={`${styles.user} pressable`}
              onClick={() => setEditingId(user.id)}
            >
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
              <span className={styles.badges}>
                <Badge tone={user.role === 'student' ? 'quiet' : 'good'}>
                  {roleLabel[user.role]}
                </Badge>
                {user.posting_suspended_until && <Badge tone="attention">Paused</Badge>}
                {user.archived_at && <Badge tone="quiet">Left</Badge>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet
        open={editing !== null}
        title={editing?.full_name ?? ''}
        onClose={() => setEditingId(null)}
      >
        {editing && <UserEditor key={editing.id} user={editing} />}
      </Sheet>
    </AdminPage>
  );
}

function UserEditor({ user }: { user: AdminUser }) {
  const setRole = useSetRole();
  const updateProfile = useUpdateProfile();
  const toggle = useToggleResponsibility();
  const grades = useActiveGrades();
  const sections = useSections().data ?? [];
  const [fullName, setFullName] = useState(user.full_name);
  const [grade, setGrade] = useState(user.grade ? String(user.grade) : '');
  const [section, setSection] = useState(user.section ?? '');
  const [newRole, setNewRole] = useState<Role | null>(null);
  const isStaffUser = user.role !== 'student';
  const gradeSections = sections.filter((s) => String(s.grade) === grade);

  return (
    <>
      <p className="meta">{user.email}</p>
      {user.archived_at && (
        <p className={styles.warning}>Left the school on {formatDateTime(user.archived_at)}.</p>
      )}

      <SelectField
        label="Role"
        value={user.role}
        disabled={setRole.isPending}
        onChange={(e) => setNewRole(e.target.value as Role)}
      >
        {roles.map((role) => (
          <option key={role} value={role}>
            {roleLabel[role]}
          </option>
        ))}
      </SelectField>

      <TextField label="Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <FieldRow>
        <SelectField
          label="Grade"
          value={grade}
          onChange={(e) => {
            setGrade(e.target.value);
            setSection('');
          }}
        >
          <option value="">None</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Section"
          value={section}
          disabled={!grade}
          onChange={(e) => setSection(e.target.value)}
        >
          <option value="">None</option>
          {gradeSections.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </FieldRow>
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
      <FormError message={updateProfile.isError ? errorMessage(updateProfile.error) : null} />

      {isStaffUser ? (
        <Card className={styles.panel}>
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

      <PostingPanel user={user} />

      <ConfirmDialog
        open={newRole !== null}
        title={`Make ${user.full_name} ${newRole === 'admin' ? 'an' : 'a'} ${newRole ? roleLabel[newRole].toLowerCase() : ''}?`}
        confirmLabel="Change role"
        tone={newRole === 'admin' ? 'alert' : 'primary'}
        busy={setRole.isPending}
        error={setRole.isError ? errorMessage(setRole.error) : null}
        onClose={() => setNewRole(null)}
        onConfirm={() =>
          newRole &&
          setRole.mutate({ userId: user.id, role: newRole }, { onSuccess: () => setNewRole(null) })
        }
      >
        <p>
          {newRole === 'student'
            ? 'They lose staff screens and any responsibilities they hold.'
            : newRole === 'admin'
              ? 'Admins can change everything, including other people’s roles.'
              : 'Teachers can approve events, post announcements and see staff screens.'}
        </p>
        <p className="meta">The change is recorded in the audit log.</p>
      </ConfirmDialog>
    </>
  );
}

/** Pause or resume posting (announcements, posts, requests, events, reports). */
function PostingPanel({ user }: { user: AdminUser }) {
  const suspend = useSuspendPosting();
  const lift = useLiftSuspension();
  const weekFromNow = toDateTimeInputValue(new Date(Date.now() + 7 * 86_400_000));
  const [until, setUntil] = useState(weekFromNow);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  if (user.posting_suspended_until) {
    return (
      <Card className={styles.panel}>
        <h3>Posting paused</h3>
        <p>
          Until {formatDateTime(user.posting_suspended_until)}
          {user.suspension_reason ? `: ${user.suspension_reason}` : '.'}
        </p>
        <Button variant="secondary" loading={lift.isPending} onClick={() => lift.mutate(user.id)}>
          Lift the suspension
        </Button>
      </Card>
    );
  }

  return (
    <Card className={styles.panel}>
      <h3>Pause posting</h3>
      <p className="meta">
        They can still read everything, but can't post announcements, collab posts or requests,
        events or fix-it reports until then. They see why.
      </p>
      <TextField
        label="Until"
        type="datetime-local"
        value={until}
        onChange={(e) => setUntil(e.target.value)}
      />
      <TextField
        label="Reason (shown to them)"
        value={reason}
        maxLength={300}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button variant="alert" disabled={!until} onClick={() => setConfirming(true)}>
        Pause posting
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`Pause ${user.full_name}'s posting?`}
        confirmLabel="Pause posting"
        busy={suspend.isPending}
        error={suspend.isError ? errorMessage(suspend.error) : null}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          suspend.mutate(
            { userId: user.id, until: fromDateTimeInputValue(until) ?? '', reason },
            { onSuccess: () => setConfirming(false) },
          )
        }
      >
        <p>Until {until ? formatDateTime(fromDateTimeInputValue(until) ?? '') : '…'}.</p>
      </ConfirmDialog>
    </Card>
  );
}
