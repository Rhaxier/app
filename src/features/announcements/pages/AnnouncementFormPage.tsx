// "New announcement" and "Edit announcement" share this page. With an :id in
// the address it loads that announcement and saves changes; without one it
// creates a new announcement.
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { errorMessage } from '@/lib/errors';
import { AnnouncementForm } from '../components/AnnouncementForm';
import { useAnnouncement, useCreateAnnouncement, useUpdateAnnouncement } from '../hooks';
import {
  emptyAnnouncementValues,
  toAnnouncementInput,
  valuesFromAnnouncement,
  type AnnouncementFormValues,
} from '../validation';

export function NewAnnouncementPage() {
  const navigate = useNavigate();
  const create = useCreateAnnouncement();

  function handleSubmit(values: AnnouncementFormValues) {
    create.mutate(toAnnouncementInput(values), {
      onSuccess: (id) => navigate(`/announcements/${id}`, { replace: true }),
    });
  }

  return (
    <div className="stack">
      <PageHeader
        back={{ to: '/announcements', label: 'Announcements' }}
        title="New announcement"
      />
      <AnnouncementForm
        initialValues={emptyAnnouncementValues}
        submitLabel="Post"
        cancelTo="/announcements"
        submitting={create.isPending}
        submitError={create.isError ? errorMessage(create.error) : null}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export function EditAnnouncementPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const announcement = useAnnouncement(id);
  const update = useUpdateAnnouncement(id);

  function handleSubmit(values: AnnouncementFormValues) {
    update.mutate(toAnnouncementInput(values), {
      onSuccess: () => navigate(`/announcements/${id}`, { replace: true }),
    });
  }

  const header = (
    <PageHeader
      back={{ to: `/announcements/${id}`, label: 'Announcement' }}
      title="Edit announcement"
    />
  );
  if (announcement.isPending) return <LoadingState />;
  if (announcement.isError) {
    return <ErrorState error={announcement.error} onRetry={() => announcement.refetch()} />;
  }
  if (!announcement.data) {
    return (
      <div className="stack">
        {header}
        <EmptyState title="Not found" />
      </div>
    );
  }

  return (
    <div className="stack">
      {header}
      {/* Rendered only once the data is here, so the form starts with it. */}
      <AnnouncementForm
        initialValues={valuesFromAnnouncement(announcement.data)}
        submitLabel="Save changes"
        cancelTo={`/announcements/${id}`}
        submitting={update.isPending}
        submitError={update.isError ? errorMessage(update.error) : null}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
