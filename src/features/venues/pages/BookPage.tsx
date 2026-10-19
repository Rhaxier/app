// Book a venue (reference screen 4): pick a venue and a day, tap free slots,
// then Request. The calendar listens to Realtime, so an approval made
// elsewhere appears here at once.
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink } from '@/components/Button';
import { FilterChip } from '@/components/Chip';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { useAppSettings } from '@/features/settings/hooks';
import { dayRange, formatTimeRange } from '@/lib/dates';
import type { Venue } from '../api';
import { DateStrip } from '../components/DateStrip';
import { SlotList } from '../components/SlotList';
import { useApprovedBookings, useLiveBookings, useVenues, useWaitingRequests } from '../hooks';
import {
  buildSlots,
  firstBookableDay,
  nextSelection,
  schoolDaysOfWeek,
  selectionTimes,
  slotStates,
  type Selection,
  type SlotSettings,
} from '../logic';
import styles from './BookPage.module.css';

export function BookPage() {
  const settings = useAppSettings();
  const venues = useVenues();

  if (settings.isPending || venues.isPending) return <LoadingState />;
  if (settings.isError)
    return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  if (venues.isError) return <ErrorState error={venues.error} onRetry={() => venues.refetch()} />;

  const active = venues.data.filter((venue) => venue.active);
  if (active.length === 0) {
    return (
      <div className="stack">
        <PageHeader title="Book a venue" />
        <EmptyState icon="calendar" title="No venues yet">
          An admin adds venues on the Admin screen.
        </EmptyState>
      </div>
    );
  }
  return <BookingCalendar settings={settings.data} venues={active} />;
}

// Split out so its state starts once settings and venues are loaded.
function BookingCalendar({ settings, venues }: { settings: SlotSettings; venues: Venue[] }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  useLiveBookings();

  // Open on the first day with a slot still ahead: today during school
  // hours, otherwise the next school day (next week after the last one).
  const [weekOffset, setWeekOffset] = useState(() =>
    firstBookableDay(schoolDaysOfWeek(0, settings), settings) ? 0 : 1,
  );
  const days = schoolDaysOfWeek(weekOffset, settings);
  const [day, setDay] = useState(() => firstBookableDay(days, settings) ?? days[0]);
  const [selection, setSelection] = useState<Selection | null>(null);

  const venueId = searchParams.get('venue') ?? venues[0].id;
  const venue = venues.find((v) => v.id === venueId) ?? venues[0];
  const { start, end } = dayRange(day);
  const approved = useApprovedBookings(start, end, venue.id);
  const waiting = useWaitingRequests(venue.id, start, end);

  const slots = buildSlots(day, settings);
  const states = slotStates(slots, approved.data ?? [], waiting.data ?? [], selection);

  function chooseVenue(id: string) {
    setSearchParams({ venue: id }, { replace: true });
    setSelection(null);
  }

  function changeWeek(offset: number) {
    const nextDays = schoolDaysOfWeek(offset, settings);
    setWeekOffset(offset);
    setDay(firstBookableDay(nextDays, settings) ?? nextDays[0]);
    setSelection(null);
  }

  function request() {
    if (!selection) return;
    const times = selectionTimes(slots, selection);
    const params = new URLSearchParams({
      venue: venue.id,
      start: times.start.toISOString(),
      end: times.end.toISOString(),
    });
    navigate(`/book/request?${params}`);
  }

  const chosen = selection ? selectionTimes(slots, selection) : null;
  const caption = !venue.needs_approval
    ? "This venue doesn't need approval: free slots are booked straight away."
    : user.role === 'student'
      ? 'Your supervising teacher confirms first, then venue staff approve.'
      : 'Bookings are confirmed after admin approval';

  return (
    <div className="stack">
      <PageHeader
        title="Book a venue"
        action={
          <ButtonLink to="/book/mine" variant="secondary" size="small">
            My bookings
          </ButtonLink>
        }
      />

      <div className="row-wrap" role="group" aria-label="Venue">
        {venues.map((v) => (
          <FilterChip key={v.id} selected={v.id === venue.id} onClick={() => chooseVenue(v.id)}>
            {v.name}
          </FilterChip>
        ))}
      </div>

      <DateStrip
        days={days}
        selected={day}
        onSelect={(d) => {
          setDay(d);
          setSelection(null);
        }}
        canGoBack={weekOffset > 0}
        onPreviousWeek={() => changeWeek(weekOffset - 1)}
        onNextWeek={() => changeWeek(weekOffset + 1)}
      />

      {(approved.isError || waiting.isError) && (
        <ErrorState
          error={approved.error ?? waiting.error}
          onRetry={() => {
            approved.refetch();
            waiting.refetch();
          }}
        />
      )}
      {approved.isPending ? (
        <LoadingState />
      ) : (
        <SlotList
          slots={slots}
          states={states}
          onToggle={(index) => setSelection(nextSelection(selection, index, states))}
        />
      )}

      <div className={styles.footer}>
        <Button fullWidth disabled={!chosen} onClick={request}>
          {chosen ? `Request ${formatTimeRange(chosen.start, chosen.end)}` : 'Choose a free time'}
        </Button>
        <p className="meta">{caption}</p>
      </div>
    </div>
  );
}
