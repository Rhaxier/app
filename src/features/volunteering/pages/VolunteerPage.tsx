// Volunteer (reference screen 3; design PDF page 7, "Pick a role"): your SUPW
// hours as one large figure, a segmented filter, and events with their roles.
// Anyone can create an event (the glass "+"); a student's event waits for a teacher.
import { useState } from 'react';
import { FilterChip } from '@/components/Chip';
import { Fab } from '@/components/Fab';
import { PageHeader } from '@/components/PageHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { EventCard } from '../components/EventCard';
import { HoursSummary } from '../components/HoursSummary';
import { useEvents, useMySignups, useVolunteerCategories } from '../hooks';
import {
  activeSignupFor,
  filterByCategory,
  filterEvents,
  volunteerFilters,
  type VolunteerFilter,
} from '../logic';

export function VolunteerPage() {
  const user = useCurrentUser();
  const events = useEvents();
  const mySignups = useMySignups(user.id);
  const categories = (useVolunteerCategories().data ?? []).filter((c) => c.active);
  const [filter, setFilter] = useState<VolunteerFilter>('all');
  const [categoryId, setCategoryId] = useState('');

  const signups = mySignups.data ?? [];
  const visible = events.data
    ? filterByCategory(filterEvents(events.data, filter, signups, user.id), categoryId)
    : [];

  return (
    <div className="stack">
      <PageHeader
        eyebrow="SUPW"
        title="Volunteer"
        action={<Fab to="/volunteer/new" label="Create a volunteering event" />}
      />

      {user.role === 'student' && <HoursSummary signups={signups} events={events.data ?? []} />}

      <SegmentedControl
        label="Filter events"
        value={filter}
        onChange={setFilter}
        options={volunteerFilters}
      />

      {categories.length > 0 && (
        <div className="scroll-row" role="group" aria-label="Category">
          <FilterChip selected={categoryId === ''} onClick={() => setCategoryId('')}>
            Every category
          </FilterChip>
          {categories.map((category) => (
            <FilterChip
              key={category.id}
              selected={categoryId === category.id}
              onClick={() => setCategoryId(categoryId === category.id ? '' : category.id)}
            >
              {category.name}
            </FilterChip>
          ))}
        </div>
      )}

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
          <EventCard key={event.id} event={event} signup={activeSignupFor(event.id, signups)} />
        ))}
      </div>
    </div>
  );
}
