// Projects: TanStack Query hooks. Changes invalidate everything under
// ['projects'] so the list and the open project stay in step.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addFeedback,
  attachmentUrl,
  createProject,
  deleteAttachment,
  deleteProject,
  fetchAttachments,
  fetchProject,
  fetchProjects,
  setProjectStatus,
  shareProject,
  unshareProject,
  updateProject,
  uploadAttachment,
  type ProjectInput,
  type ProjectStatus,
} from './api';

export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
  attachments: (id: string) => [...projectKeys.all, 'attachments', id] as const,
};

export function useProjects() {
  return useQuery({ queryKey: projectKeys.list(), queryFn: fetchProjects });
}

export function useProject(id: string) {
  return useQuery({ queryKey: projectKeys.detail(id), queryFn: () => fetchProject(id) });
}

export function useAttachments(projectId: string) {
  return useQuery({
    queryKey: projectKeys.attachments(projectId),
    queryFn: () => fetchAttachments(projectId),
  });
}

function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: projectKeys.all });
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: ProjectInput) => createProject(input),
    onSuccess: invalidate,
    meta: { successMessage: 'Project created' },
  });
}

export function useUpdateProject(id: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: ProjectInput) => updateProject(id, input),
    onSuccess: invalidate,
    meta: { successMessage: 'Project saved' },
  });
}

export function useSetProjectStatus(id: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (status: ProjectStatus) => setProjectStatus(id, status),
    onSuccess: invalidate,
    meta: { successMessage: 'Status updated', errorToast: true },
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: invalidate,
    meta: { successMessage: 'Project deleted', errorToast: true },
  });
}

export function useShareProject(projectId: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (teacherId: string) => shareProject(projectId, teacherId),
    onSuccess: invalidate,
    meta: { successMessage: 'Shared. Your teacher has been told.', errorToast: true },
  });
}

export function useUnshareProject(projectId: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (teacherId: string) => unshareProject(projectId, teacherId),
    onSuccess: invalidate,
    meta: { successMessage: 'Stopped sharing', errorToast: true },
  });
}

export function useAddFeedback(projectId: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (body: string) => addFeedback(projectId, body),
    onSuccess: invalidate,
    meta: { successMessage: 'Feedback sent' },
  });
}

export function useUploadAttachment(projectId: string) {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (file: File) => uploadAttachment(projectId, file),
    onSuccess: invalidate,
    meta: { successMessage: 'File attached', errorToast: true },
  });
}

export function useDeleteAttachment() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: deleteAttachment,
    onSuccess: invalidate,
    meta: { successMessage: 'File removed', errorToast: true },
  });
}

/** Opens a short-lived download link in a new tab. */
export function useOpenAttachment() {
  return useMutation({
    mutationFn: attachmentUrl,
    onSuccess: (url) => window.open(url, '_blank', 'noopener'),
    meta: { errorToast: true },
  });
}
