// The school's structure: TanStack Query hooks. Grades and sections change
// rarely, so they're cached for ten minutes.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addSection,
  deleteSection,
  fetchClasses,
  fetchGrades,
  fetchSections,
  saveClass,
  saveGrade,
  setClassArchived,
  type ClassInput,
} from './api';

export const schoolKeys = {
  all: ['school'] as const,
  grades: () => [...schoolKeys.all, 'grades'] as const,
  sections: () => [...schoolKeys.all, 'sections'] as const,
  classes: () => [...schoolKeys.all, 'classes'] as const,
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
