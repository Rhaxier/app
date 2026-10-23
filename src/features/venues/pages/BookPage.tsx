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
import type { Period } from '@/features/school/api';
import { useBlackouts, useHolidays, usePeriods, useTerms } from '@/features/school/hooks';
import { dayNote, type CalendarData } from '@/features/school/logic';
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
  // The school calendar (Admin > School calendar): which periods can be
  // booked, and which days are holidays or blacked out.
  const periods = usePeriods();
  const terms = useTerms();
  const holidays = useHolidays();
  const blackouts = useBlackouts();
  const queries = [settings, venues, periods, terms, holidays, blackouts];

  if (queries.some((q) => q.isPending)) return <LoadingState shape="slot" />;
  const failed = queries.find((q) => q.isError);
  if (failed) return <ErrorState error={failed.error} onRetry={() => failed.refetch()} />;
  if (!settings.data || !venues.data || !periods.data) return null;

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
  const calendar: CalendarData = {
    schoolDays: settings.data.school_days,
    terms: terms.data ?? [],
    holidays: holidays.data ?? [],
    blackouts: blackouts.data ?? [],
  };
  return (
    <BookingCalendar
      settings={settings.data}
      periods={periods.data}
      calendar={calendar}
      venues={active}
    />
  );
}

interface BookingCalendarProps {
  settings: SlotSettings;
  periods: Period[];
  calendar: CalendarData;
  venues: Venue[];
}

// Split out so its state starts once settings and venues are loaded.
function BookingCalendar({ settings, periods, calendar, venues }: BookingCalendarProps) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  useLiveBookings();

  const venueId = searchParams.get('venue') ?? venues[0].id;
  const venue = venues.find((v) => v.id === venueId) ?? venues[0];
  // Holidays and this venue's blackouts can't be booked (the database refuses them).
  const isBlocked = (d: string) => dayNote(d, calendar, venue.id)?.blocked ?? false;
  const firstDay = (list: string[]) => firstBookableDay(list, periods, new Date(), isBlocked);

  // Open on the first day with a slot still ahead: today during school
  // hours, otherwise the next bookable day (next week after the last one).
  const [weekOffset, setWeekOffset] = useState(() =>
    firstDay(schoolDaysOfWeek(0, settings)) ? 0 : 1,
  );
  const days = schoolDaysOfWeek(weekOffset, settings);
  const [day, setDay] = useState(() => firstDay(days) ?? days[0]);
  const [selection, setSelection] = useState<Selection | null>(null);

  const { start, end } = dayRange(day);
  const approved = useApprovedBookings(start, end, venue.id);
  const waiting = useWaitingRequests(venue.id, start, end);

  const slots = buildSlots(day, periods);
  const blockedNote = isBlocked(day) ? dayNote(day, calendar, venue.id)?.text : null;
  const states = slotStates(slots, approved.data ?? [], waiting.data ?? [], selection);

  function chooseVenue(id: string) {
    setSearchParams({ venue: id }, { replace: true });
    setSelection(null);
  }

  function changeWeek(offset: number) {
    const nextDays = schoolDaysOfWeek(offset, settings);
    setWeekOffset(offset);
    setDay(firstDay(nextDays) ?? nextDays[0]);
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
        dayNoteFor={(d) =>
          dayNote(d, calendar, venue.id)?.text ??
          (buildSlots(d, periods).length === 0 ? 'No bookable periods' : null)
        }
        isDisabled={(d) => isBlocked(d) || buildSlots(d, periods).length === 0}
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
      {blockedNote ? (
        <EmptyState icon="calendar" title="Can't be booked this day">
          {blockedNote}
        </EmptyState>
      ) : slots.length === 0 ? (
        <EmptyState icon="calendar" title="No bookable periods this day" />
      ) : approved.isPending ? (
        <LoadingState shape="slot" />
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
