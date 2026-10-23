// Admin screens: TanStack Query hooks. Changes invalidate ['admin'] (and the
// shared caches they affect, like settings or the people list).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsKeys } from '@/features/settings/hooks';
import {
  addResponsibility,
  fetchAttention,
  fetchMetrics,
  fetchSupwByGrade,
  fetchVenueUtilisation,
  importPeople,
  liftSuspension,
  rollover,
  suspendPosting,
  type ImportRow,
  addStaffEmail,
  createVenue,
  fetchAuditLog,
  fetchContentReports,
  fetchOutbox,
  fetchStaffEmails,
  fetchUsers,
  removeResponsibility,
  removeStaffEmail,
  setContentReportStatus,
  setRole,
  updateProfile,
  updateSettings,
  updateVenue,
  type Responsibility,
  type Role,
  type SettingsChanges,
  type VenueFields,
} from './api';

export const adminKeys = {
  all: ['admin'] as const,
  attention: () => [...adminKeys.all, 'attention'] as const,
  metrics: () => [...adminKeys.all, 'metrics'] as const,
  utilisation: (days: number) => [...adminKeys.all, 'utilisation', days] as const,
  supwByGrade: (days: number) => [...adminKeys.all, 'supw-by-grade', days] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  staffEmails: () => [...adminKeys.all, 'staff-emails'] as const,
  contentReports: () => [...adminKeys.all, 'content-reports'] as const,
  audit: (table: string | null) => [...adminKeys.all, 'audit', table ?? 'all'] as const,
  outbox: (table: string) => [...adminKeys.all, 'outbox', table] as const,
};

function useInvalidate(...extraKeys: (readonly string[])[]) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.all });
    for (const key of extraKeys) queryClient.invalidateQueries({ queryKey: key });
  };
}

// Overview -------------------------------------------------------------------

export function useAttention() {
  return useQuery({ queryKey: adminKeys.attention(), queryFn: fetchAttention });
}

export function useMetrics() {
  return useQuery({ queryKey: adminKeys.metrics(), queryFn: fetchMetrics });
}

export function useVenueUtilisation(days: number) {
  return useQuery({
    queryKey: adminKeys.utilisation(days),
    queryFn: () => fetchVenueUtilisation(days),
  });
}

export function useSupwByGrade(days: number) {
  return useQuery({ queryKey: adminKeys.supwByGrade(days), queryFn: () => fetchSupwByGrade(days) });
}

// Users ----------------------------------------------------------------------

export function useUsers() {
  return useQuery({ queryKey: adminKeys.users(), queryFn: fetchUsers });
}

export function useSuspendPosting() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ userId, until, reason }: { userId: string; until: string; reason: string }) =>
      suspendPosting(userId, until, reason),
    onSuccess: invalidate,
    meta: { successMessage: 'Posting paused' },
  });
}

export function useLiftSuspension() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: liftSuspension,
    onSuccess: invalidate,
    meta: { successMessage: 'Suspension lifted', errorToast: true },
  });
}

/** The preview: checks every row, saves nothing. */
export function useImportPreview() {
  return useMutation({ mutationFn: (rows: ImportRow[]) => importPeople(rows, true) });
}

export function useImportPeople() {
  const invalidate = useInvalidate(['people'], ['school']);
  return useMutation({
    mutationFn: (rows: ImportRow[]) => importPeople(rows, false),
    onSuccess: invalidate,
  });
}

export function useRolloverPreview() {
  return useQuery({
    queryKey: [...adminKeys.all, 'rollover-preview'],
    queryFn: () => rollover(true),
  });
}

export function useRollover() {
  const invalidate = useInvalidate(['people'], ['current-user']);
  return useMutation({
    mutationFn: (confirm: string) => rollover(false, confirm),
    onSuccess: invalidate,
    meta: { successMessage: 'Rollover done. Everyone has moved up a grade.' },
  });
}

export function useSetRole() {
  const invalidate = useInvalidate(['people'], ['current-user']);
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) => setRole(userId, role),
    onSuccess: invalidate,
    meta: { successMessage: 'Role changed' },
  });
}

export function useUpdateProfile() {
  const invalidate = useInvalidate(['people']);
  return useMutation({
    mutationFn: ({
      userId,
      fullName,
      grade,
      section,
    }: {
      userId: string;
      fullName: string;
      grade: number | null;
      section: string;
    }) => updateProfile(userId, { fullName, grade, section }),
    onSuccess: invalidate,
    meta: { successMessage: 'Saved' },
  });
}

export function useToggleResponsibility() {
  const invalidate = useInvalidate(['current-user']);
  return useMutation({
    mutationFn: ({
      userId,
      kind,
      holds,
    }: {
      userId: string;
      kind: Responsibility;
      holds: boolean;
    }) => (holds ? removeResponsibility(userId, kind) : addResponsibility(userId, kind)),
    onSuccess: invalidate,
    meta: { errorToast: true },
  });
}

export function useStaffEmails() {
  return useQuery({ queryKey: adminKeys.staffEmails(), queryFn: fetchStaffEmails });
}

export function useAddStaffEmail() {
  const invalidate = useInvalidate(['people']);
  return useMutation({ mutationFn: addStaffEmail, onSuccess: invalidate });
}

export function useRemoveStaffEmail() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: removeStaffEmail, onSuccess: invalidate });
}

export function useUpdateSettings() {
  const invalidate = useInvalidate(settingsKeys.all);
  return useMutation({
    mutationFn: (changes: SettingsChanges) => updateSettings(changes),
    onSuccess: invalidate,
    meta: { successMessage: 'Saved', errorToast: true },
  });
}

export function useSaveVenue() {
  const invalidate = useInvalidate(['venues']);
  return useMutation({
    mutationFn: ({ id, fields }: { id: string | null; fields: VenueFields }) =>
      id ? updateVenue(id, fields) : createVenue(fields),
    onSuccess: invalidate,
    meta: { successMessage: 'Venue saved' },
  });
}

export function useContentReports(enabled = true) {
  return useQuery({ queryKey: adminKeys.contentReports(), queryFn: fetchContentReports, enabled });
}

export function useSetContentReportStatus(reviewerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'actioned' | 'dismissed' }) =>
      setContentReportStatus(id, status, reviewerId),
    onSuccess: invalidate,
  });
}

export function useAuditLog(table: string | null) {
  return useQuery({ queryKey: adminKeys.audit(table), queryFn: () => fetchAuditLog(table) });
}

export function useOutbox(table: 'email_outbox' | 'push_outbox') {
  return useQuery({ queryKey: adminKeys.outbox(table), queryFn: () => fetchOutbox(table) });
}
