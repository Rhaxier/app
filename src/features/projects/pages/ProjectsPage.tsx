// Projects (reference screen 5). Students see their own work with All /
// Shared / Drafts; teachers see what's been shared with them.
import { useState } from 'react';
import { Fab } from '@/components/Fab';
import { PageHeader } from '@/components/PageHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { isStaff } from '@/lib/permissions';
import { ProjectCard } from '../components/ProjectCard';
import { useProjects } from '../hooks';
import { filterProjects, studentSegments, teacherSegments, type ProjectSegment } from '../logic';

export function ProjectsPage() {
  const user = useCurrentUser();
  const projects = useProjects();
  const staff = isStaff(user);
  const [segment, setSegment] = useState<ProjectSegment>('all');

  // Admins can read every project; teachers only shared ones. Both are
  // reviewing other people's work here, so they get the reviewer's view.
  const mine = projects.data?.filter((project) => project.owner_id === user.id) ?? [];
  const others = projects.data?.filter((project) => project.owner_id !== user.id) ?? [];
  const list = filterProjects(staff ? others : mine, segment);

  return (
    <div className="stack">
      <PageHeader
        back={{ to: '/', label: 'Home' }}
        title="Projects"
        subtitle={staff ? 'Student work shared with you' : 'Share your work with teachers'}
        action={!staff && <Fab to="/projects/new" label="New project" />}
      />
      <SegmentedControl
        label="Show"
        value={segment}
        onChange={setSegment}
        options={staff ? teacherSegments : studentSegments}
      />
      {projects.isPending && <LoadingState />}
      {projects.isError && <ErrorState error={projects.error} onRetry={() => projects.refetch()} />}
      {projects.data && list.length === 0 && (
        <EmptyState icon="folder" title={staff ? 'Nothing here yet' : 'No projects here'}>
          {staff
            ? 'When a student shares a project with you, it appears here.'
            : 'Add a project, then share it with a teacher for feedback.'}
        </EmptyState>
      )}
      <div className="stack-tight">
        {list.map((project) => (
          <ProjectCard key={project.id} project={project} showOwner={staff} canShare={!staff} />
        ))}
      </div>
    </div>
  );
}
