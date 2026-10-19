// Volunteer (reference screen 3): SUPW opportunities with filter chips.
// Anyone can create an event; a student's event waits for a teacher.
import { useState } from 'react';
import { FilterChip } from '@/components/Chip';
import { Fab } from '@/components/Fab';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { EventCard } from '../components/EventCard';
import { HoursSummary } from '../components/HoursSummary';
import { useEvents, useMySignups } from '../hooks';
import { filterEvents, isActiveSignup, volunteerFilters, type VolunteerFilter } from '../logic';

export function VolunteerPage() {
  const user = useCurrentUser();
  const events = useEvents();
  const mySignups = useMySignups(user.id);
  const [filter, setFilter] = useState<VolunteerFilter>('all');

  const signups = mySignups.data ?? [];
  const visible = events.data ? filterEvents(events.data, filter, signups, user.id) : [];
  const signedUpFor = new Set(signups.filter(isActiveSignup).map((signup) => signup.event_id));

  return (
    <div className="stack">
      <PageHeader
        eyebrow="SUPW opportunities"
        title="Volunteer"
        action={<Fab to="/volunteer/new" label="Create a volunteering event" />}
      />

      {user.role === 'student' && <HoursSummary signups={signups} />}

      <div className="row-wrap" role="group" aria-label="Filter events">
        {volunteerFilters.map((option) => (
          <FilterChip
            key={option.value}
            selected={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </FilterChip>
        ))}
      </div>

      {events.isPending && <LoadingState />}
      {events.isError && <ErrorState error={events.error} onRetry={() => events.refetch()} />}
      {events.data && visible.length === 0 && (
        <EmptyState
          icon="heart"
          title={filter === 'mine' ? "You haven't signed up yet" : 'No events here'}
        >
          {filter === 'all' ? 'New volunteering events will appear here.' : 'Try another filter.'}
        </EmptyState>
      )}
      <div className="stack-tight">
        {visible.map((event) => (
          <EventCard key={event.id} event={event} signedUp={signedUpFor.has(event.id)} />
        ))}
      </div>
    </div>
  );
}
