// Projects (reference screen 5; design PDF page 8). Students see their own
// work with All / Shared / Drafts, grouped in one card, and one primary
// action under it: New project. Teachers see what's been shared with them.
import { useState } from 'react';
import { ButtonLink } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { isStaff } from '@/lib/permissions';
import { ProjectCard } from '../components/ProjectCard';
import { useProjects } from '../hooks';
import { filterProjects, studentSegments, teacherSegments, type ProjectSegment } from '../logic';
import styles from './ProjectsPage.module.css';

export function ProjectsPage() {
  const user = useCurrentUser();
  const projects = useProjects();
  const staff = isStaff(user);
  const [segment, setSegment] = useState<ProjectSegment>('all');

  // Admins can read every project; teachers only shared ones. Both are
  // reviewing other people's work here, so they get the reviewer's view.
  const mine = projects.data?.filter((project) => project.owner_id === user.id) ?? [];
  const others = projects.data?.filter((project) => project.owner_id !== user.id) ?? [];
  const all = staff ? others : mine;
  const list = filterProjects(all, segment);
  // "All 3 · Shared 2 · Drafts 1": each option shows how many it holds.
  const options = (staff ? teacherSegments : studentSegments).map((option) => ({
    ...option,
    count: projects.data ? filterProjects(all, option.value).length : undefined,
  }));

  return (
    <div className="stack">
      <PageHeader
        back={{ to: '/', label: 'Home' }}
        meta={
          projects.data ? `${all.length} ${all.length === 1 ? 'project' : 'projects'}` : undefined
        }
        title="Projects"
        subtitle={
          staff
            ? 'Student work shared with you.'
            : 'Share your work with teachers. Feedback lands here.'
        }
      />
      <SegmentedControl label="Show" value={segment} onChange={setSegment} options={options} />
      {projects.isPending && <LoadingState />}
      {projects.isError && <ErrorState error={projects.error} onRetry={() => projects.refetch()} />}
      {projects.data && list.length === 0 && (
        <EmptyState icon="folder" title={staff ? 'Nothing here yet' : 'No projects here'}>
          {staff
            ? 'When a student shares a project with you, it appears here.'
            : 'Add a project, then share it with a teacher for feedback.'}
        </EmptyState>
      )}
      {list.length > 0 && (
        <ul className={`${styles.list} stagger`}>
          {list.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} showOwner={staff} canShare={!staff} />
            </li>
          ))}
        </ul>
      )}
      {!staff && (
        <ButtonLink to="/projects/new" icon="plus" fullWidth>
          New project
        </ButtonLink>
      )}
    </div>
  );
}
