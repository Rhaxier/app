// /collab/new and /collab/:id/edit.
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAppSettings } from '@/features/settings/hooks';
import { errorMessage } from '@/lib/errors';
import { CollabForm } from '../components/CollabForm';
import { useCreatePost, usePost, useUpdatePost } from '../hooks';
import { emptyCollabValues, toPostInput, valuesFromPost } from '../logic';

export function NewCollabPage() {
  const navigate = useNavigate();
  const settings = useAppSettings();
  const create = useCreatePost();
  return (
    <div className="stack">
      <PageHeader back={{ to: '/collab', label: 'Collab finder' }} title="New post" />
      <CollabForm
        initialValues={emptyCollabValues}
        teacherRequired={settings.data?.collab_requires_teacher ?? false}
        submitLabel="Post"
        cancelTo="/collab"
        submitting={create.isPending}
        submitError={create.isError ? errorMessage(create.error) : null}
        onSubmit={(values) =>
          create.mutate(toPostInput(values), {
            onSuccess: (id) => navigate(`/collab/${id}`, { replace: true }),
          })
        }
      />
    </div>
  );
}

export function EditCollabPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const settings = useAppSettings();
  const post = usePost(id);
  const update = useUpdatePost(id);

  if (post.isPending) return <LoadingState />;
  if (post.isError) return <ErrorState error={post.error} onRetry={() => post.refetch()} />;
  if (!post.data) return <EmptyState title="Not found" />;

  return (
    <div className="stack">
      <PageHeader back={{ to: `/collab/${id}`, label: 'Post' }} title="Edit post" />
      <CollabForm
        initialValues={valuesFromPost(post.data)}
        teacherRequired={settings.data?.collab_requires_teacher ?? false}
        acceptedCount={post.data.accepted_count}
        submitLabel="Save changes"
        cancelTo={`/collab/${id}`}
        submitting={update.isPending}
        submitError={update.isError ? errorMessage(update.error) : null}
        onSubmit={(values) =>
          update.mutate(toPostInput(values), {
            onSuccess: () => navigate(`/collab/${id}`, { replace: true }),
          })
        }
      />
    </div>
  );
}
