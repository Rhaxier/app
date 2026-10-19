// /projects/new and /projects/:id/edit.
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { errorMessage } from '@/lib/errors';
import { ProjectForm } from '../components/ProjectForm';
import { useCreateProject, useProject, useUpdateProject } from '../hooks';
import { emptyProjectValues, toProjectInput, valuesFromProject } from '../logic';

export function NewProjectPage() {
  const navigate = useNavigate();
  const create = useCreateProject();
  return (
    <div className="stack">
      <PageHeader back={{ to: '/projects', label: 'Projects' }} title="New project" />
      <ProjectForm
        initialValues={emptyProjectValues}
        submitLabel="Save draft"
        cancelTo="/projects"
        submitting={create.isPending}
        submitError={create.isError ? errorMessage(create.error) : null}
        onSubmit={(values) =>
          create.mutate(toProjectInput(values), {
            onSuccess: (id) => navigate(`/projects/${id}`, { replace: true }),
          })
        }
      />
    </div>
  );
}

export function EditProjectPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const project = useProject(id);
  const update = useUpdateProject(id);

  if (project.isPending) return <LoadingState />;
  if (project.isError)
    return <ErrorState error={project.error} onRetry={() => project.refetch()} />;
  if (!project.data) return <EmptyState title="Not found" />;

  return (
    <div className="stack">
      <PageHeader back={{ to: `/projects/${id}`, label: 'Project' }} title="Edit project" />
      <ProjectForm
        initialValues={valuesFromProject(project.data)}
        submitLabel="Save changes"
        cancelTo={`/projects/${id}`}
        submitting={update.isPending}
        submitError={update.isError ? errorMessage(update.error) : null}
        onSubmit={(values) =>
          update.mutate(toProjectInput(values), {
            onSuccess: () => navigate(`/projects/${id}`, { replace: true }),
          })
        }
      />
    </div>
  );
}
