// The school's structure: TanStack Query hooks. Grades and sections change
// rarely, so they're cached for ten minutes.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppSettings } from '@/features/settings/hooks';
import {
  addSection,
  deleteCalendarRow,
  deleteSection,
  fetchBlackouts,
  fetchHolidays,
  fetchPeriods,
  fetchTerms,
  importPeriods,
  saveCalendarRow,
  type CalendarFields,
  type CalendarTable,
  fetchClasses,
  fetchGrades,
  fetchSections,
  saveClass,
  saveGrade,
  setClassArchived,
  type ClassInput,
  type PeriodCsvRow,
} from './api';
import type { CalendarData } from './logic';

export const schoolKeys = {
  all: ['school'] as const,
  grades: () => [...schoolKeys.all, 'grades'] as const,
  sections: () => [...schoolKeys.all, 'sections'] as const,
  classes: () => [...schoolKeys.all, 'classes'] as const,
  calendar: (table: CalendarTable) => [...schoolKeys.all, 'calendar', table] as const,
};

export function useGrades() {
  return useQuery({ queryKey: schoolKeys.grades(), queryFn: fetchGrades, staleTime: 10 * 60_000 });
}

/** Just the grade numbers in use, e.g. [8, 10, 12], for pickers. */
export function useActiveGrades(): number[] {
  return (useGrades().data ?? []).filter((g) => g.active).map((g) => g.grade);
}

export function useSections() {
  return useQuery({
    queryKey: schoolKeys.sections(),
    queryFn: fetchSections,
    staleTime: 10 * 60_000,
  });
}

export function useClasses() {
  return useQuery({ queryKey: schoolKeys.classes(), queryFn: fetchClasses });
}

function useInvalidateSchool() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: schoolKeys.all });
}

export function useSaveGrade() {
  const invalidate = useInvalidateSchool();
  return useMutation({
    mutationFn: ({
      id,
      fields,
    }: {
      id: string | null;
      fields: { grade: number; name: string; active: boolean };
    }) => saveGrade(id, fields),
    onSuccess: invalidate,
    meta: { successMessage: 'Grade saved', errorToast: true },
  });
}

export function useAddSection() {
  const invalidate = useInvalidateSchool();
  return useMutation({
    mutationFn: ({ grade, name }: { grade: number; name: string }) => addSection(grade, name),
    onSuccess: invalidate,
    meta: { successMessage: 'Section added', errorToast: true },
  });
}

export function useDeleteSection() {
  const invalidate = useInvalidateSchool();
  return useMutation({
    mutationFn: deleteSection,
    onSuccess: invalidate,
    meta: { successMessage: 'Section removed', errorToast: true },
  });
}

export function useSaveClass() {
  const invalidate = useInvalidateSchool();
  return useMutation({
    mutationFn: (input: ClassInput) => saveClass(input),
    onSuccess: invalidate,
    meta: { successMessage: 'Class saved' },
  });
}

export function useSetClassArchived() {
  const invalidate = useInvalidateSchool();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      setClassArchived(id, archived),
    onSuccess: invalidate,
    meta: { successMessage: 'Class updated', errorToast: true },
  });
}

// ---------------------------------------------------------------------------
// The school calendar
// ---------------------------------------------------------------------------

export function usePeriods() {
  return useQuery({
    queryKey: schoolKeys.calendar('periods'),
    queryFn: fetchPeriods,
    staleTime: 10 * 60_000,
  });
}

export function useTerms() {
  return useQuery({
    queryKey: schoolKeys.calendar('terms'),
    queryFn: fetchTerms,
    staleTime: 10 * 60_000,
  });
}

export function useHolidays() {
  return useQuery({
    queryKey: schoolKeys.calendar('holidays'),
    queryFn: fetchHolidays,
    staleTime: 10 * 60_000,
  });
}

export function useBlackouts() {
  return useQuery({
    queryKey: schoolKeys.calendar('venue_blackouts'),
    queryFn: fetchBlackouts,
    staleTime: 10 * 60_000,
  });
}

/** Everything dayNote() needs, once it has all loaded (null until then). */
export function useCalendarData(): CalendarData | null {
  const settings = useAppSettings();
  const terms = useTerms();
  const holidays = useHolidays();
  const blackouts = useBlackouts();
  if (!settings.data || !terms.data || !holidays.data || !blackouts.data) return null;
  return {
    schoolDays: settings.data.school_days,
    terms: terms.data,
    holidays: holidays.data,
    blackouts: blackouts.data,
  };
}

const savedMessage: Record<CalendarTable, string> = {
  periods: 'Period saved',
  terms: 'Term saved',
  holidays: 'Holiday saved',
  venue_blackouts: 'Blackout saved',
};

export function useSaveCalendarRow<T extends CalendarTable>(table: T) {
  const invalidate = useInvalidateSchool();
  return useMutation({
    mutationFn: ({ id, fields }: { id: string | null; fields: CalendarFields[T] }) =>
      saveCalendarRow(table, id, fields),
    onSuccess: invalidate,
    meta: { successMessage: savedMessage[table] },
  });
}

export function useDeleteCalendarRow(table: CalendarTable) {
  const invalidate = useInvalidateSchool();
  return useMutation({
    mutationFn: (id: string) => deleteCalendarRow(table, id),
    onSuccess: invalidate,
    meta: { successMessage: 'Deleted', errorToast: true },
  });
}

// ---------------------------------------------------------------------------
// Bell times upload
// ---------------------------------------------------------------------------

/** The preview: checks every row, saves nothing. */
export function usePeriodImportPreview() {
  return useMutation({ mutationFn: (rows: PeriodCsvRow[]) => importPeriods(rows, true) });
}

export function useImportPeriods() {
  const invalidate = useInvalidateSchool();
  return useMutation({
    mutationFn: (rows: PeriodCsvRow[]) => importPeriods(rows, false),
    onSuccess: invalidate,
    meta: { successMessage: 'Bell times updated' },
  });
}
