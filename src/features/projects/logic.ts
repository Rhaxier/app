// Projects: plain functions for the screens (tested in projects.test.tsx).
import type { Project, ProjectInput } from './api';

/** Students sort their own work; teachers sort what's waiting for them. */
export type ProjectSegment = 'all' | 'shared' | 'drafts' | 'waiting' | 'reviewed';

export const studentSegments: { value: ProjectSegment; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'shared', label: 'Shared' },
  { value: 'drafts', label: 'Drafts' },
];

export const teacherSegments: { value: ProjectSegment; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'waiting', label: 'To review' },
  { value: 'reviewed', label: 'Reviewed' },
];

export function filterProjects(projects: Project[], segment: ProjectSegment): Project[] {
  switch (segment) {
    case 'shared':
      return projects.filter((project) => project.shares.length > 0);
    case 'drafts':
      return projects.filter((project) => project.shares.length === 0);
    case 'waiting':
      return projects.filter(
        (project) => project.status === 'shared' || project.status === 'in_review',
      );
    case 'reviewed':
      return projects.filter(
        (project) => project.status === 'feedback_given' || project.status === 'complete',
      );
    default:
      return projects;
  }
}

/** "Physics · Shared with Teacher A" / "Computer Science · Not shared yet" */
export function sharingLine(project: Project): string {
  const teachers = project.shares.map((share) => share.teacher?.full_name).filter(Boolean);
  const sharing = teachers.length > 0 ? `Shared with ${teachers.join(', ')}` : 'Not shared yet';
  return [project.subject, sharing].filter(Boolean).join(' · ');
}

export interface ProjectFormValues {
  title: string;
  subject: string;
  description: string;
  linkUrl: string;
}

export type ProjectFormErrors = Partial<Record<keyof ProjectFormValues, string>>;

export const emptyProjectValues: ProjectFormValues = {
  title: '',
  subject: '',
  description: '',
  linkUrl: '',
};

export function validateProject(values: ProjectFormValues): ProjectFormErrors {
  const errors: ProjectFormErrors = {};
  if (!values.title.trim()) errors.title = 'Add a title.';
  else if (values.title.trim().length > 120) errors.title = 'Keep the title under 120 characters.';
  if (values.subject.length > 60) errors.subject = 'Keep the subject under 60 characters.';
  // Mirrors the table's check: links must be web addresses.
  if (values.linkUrl.trim() && !/^https?:\/\//i.test(values.linkUrl.trim())) {
    errors.linkUrl = 'Links start with https:// (or http://).';
  }
  return errors;
}

export function valuesFromProject(project: Project): ProjectFormValues {
  return {
    title: project.title,
    subject: project.subject ?? '',
    description: project.description,
    linkUrl: project.link_url ?? '',
  };
}

export function toProjectInput(values: ProjectFormValues): ProjectInput {
  return {
    title: values.title.trim(),
    subject: values.subject.trim() || null,
    description: values.description.trim(),
    link_url: values.linkUrl.trim() || null,
  };
}
