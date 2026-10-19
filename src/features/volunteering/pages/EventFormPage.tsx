// /volunteer/new and /volunteer/:id/edit.
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { errorMessage } from '@/lib/errors';
import { isStaff } from '@/lib/permissions';
import { EventForm } from '../components/EventForm';
import { useCreateEvent, useEvent, useUpdateEvent } from '../hooks';
import {
  emptyEventValues,
  toEventInput,
  toRoleInputs,
  valuesFromEvent,
  type EventFormValues,
} from '../logic';

export function NewEventPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const create = useCreateEvent();

  function handleSubmit(values: EventFormValues) {
    create.mutate(
      { input: toEventInput(values), roles: toRoleInputs(values) },
      { onSuccess: (id) => navigate(`/volunteer/${id}`, { replace: true }) },
    );
  }

  return (
    <div className="stack">
      <PageHeader back={{ to: '/volunteer', label: 'Volunteer' }} title="New event" />
      <EventForm
        initialValues={emptyEventValues}
        submitLabel={isStaff(user) ? 'Publish' : 'Send for approval'}
        cancelTo="/volunteer"
        submitting={create.isPending}
        submitError={create.isError ? errorMessage(create.error) : null}
        needsApproval={!isStaff(user)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export function EditEventPage() {
  const { id = '' } = useParams();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const event = useEvent(id);
  const update = useUpdateEvent(id);

  function handleSubmit(values: EventFormValues, removedRoleIds: string[]) {
    update.mutate(
      { input: toEventInput(values), roles: toRoleInputs(values), removedRoleIds },
      { onSuccess: () => navigate(`/volunteer/${id}`, { replace: true }) },
    );
  }

  const header = (
    <PageHeader back={{ to: `/volunteer/${id}`, label: 'Event' }} title="Edit event" />
  );
  if (event.isPending) return <LoadingState />;
  if (event.isError) return <ErrorState error={event.error} onRetry={() => event.refetch()} />;
  if (!event.data) {
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
      <EventForm
        initialValues={valuesFromEvent(event.data)}
        submitLabel="Save changes"
        cancelTo={`/volunteer/${id}`}
        submitting={update.isPending}
        submitError={update.isError ? errorMessage(update.error) : null}
        needsApproval={!isStaff(user) && event.data.status !== 'published'}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
