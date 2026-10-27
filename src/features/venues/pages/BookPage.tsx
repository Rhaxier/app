// Book a venue (reference screen 4): pick a venue and a day, tap free
// periods, then Request. The list shows the chosen date's own periods, so a
// short Friday looks shorter. The calendar listens to Realtime, so an
// approval made elsewhere appears here at once.
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { FilterChip } from '@/components/Chip';
import { DateStrip } from '@/components/DateStrip';
import { FieldRow, TextField } from '@/components/Input';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import type { Period } from '@/features/school/api';
import { useBlackouts, useHolidays, usePeriods, useTerms } from '@/features/school/hooks';
import { dayNote, schoolDaysOfWeek, type CalendarData } from '@/features/school/logic';
import { useAppSettings } from '@/features/settings/hooks';
import { atSchoolTime, dayRange, formatTimeRange } from '@/lib/dates';
import type { Venue } from '../api';
import { PeriodList } from '../components/PeriodList';
import { useApprovedBookings, useLiveBookings, useVenues, useWaitingRequests } from '../hooks';
import {
  buildSlots,
  customTimesProblem,
  firstBookableDay,
  freeRun,
  nextSelection,
  selectionTimes,
  slotStates,
  type CustomTimes,
  type Selection,
  type SlotSettings,
} from '../logic';
import styles from './BookPage.module.css';

const noCustomTimes: CustomTimes = { from: '', to: '' };

export function BookPage() {
  const settings = useAppSettings();
  const venues = useVenues();
  // The school calendar (Admin > School calendar): the periods of each
  // weekday, and which days are holidays or blacked out.
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
      allowCustomTimes={settings.data.allow_custom_booking_times}
      periods={periods.data}
      calendar={calendar}
      venues={active}
    />
  );
}

interface BookingCalendarProps {
  settings: SlotSettings;
  /** Admin > Venues: people may also request times that aren't periods. */
  allowCustomTimes: boolean;
  periods: Period[];
  calendar: CalendarData;
  venues: Venue[];
}

// Split out so its state starts once settings and venues are loaded.
function BookingCalendar({
  settings,
  allowCustomTimes,
  periods,
  calendar,
  venues,
}: BookingCalendarProps) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  useLiveBookings();

  const venueId = searchParams.get('venue') ?? venues[0].id;
  const venue = venues.find((v) => v.id === venueId) ?? venues[0];
  // Holidays and this venue's blackouts can't be booked (the database refuses them).
  const isBlocked = (d: string) => dayNote(d, calendar, venue.id)?.blocked ?? false;
  const firstDay = (list: string[]) => firstBookableDay(list, periods, new Date(), isBlocked);

  // Open on the first day with a period still ahead: today during school
  // hours, otherwise the next bookable day (next week after the last one).
  const [weekOffset, setWeekOffset] = useState(() =>
    firstDay(schoolDaysOfWeek(0, settings)) ? 0 : 1,
  );
  const days = schoolDaysOfWeek(weekOffset, settings);
  const [day, setDay] = useState(() => firstDay(days) ?? days[0]);
  // Either a run of periods or a custom time is being chosen, never both.
  const [selection, setSelection] = useState<Selection | null>(null);
  const [custom, setCustom] = useState<CustomTimes>(noCustomTimes);

  const { start, end } = dayRange(day);
  const approved = useApprovedBookings(start, end, venue.id);
  const waiting = useWaitingRequests(venue.id, start, end);

  const slots = buildSlots(day, periods);
  const closedReason = isBlocked(day) ? (dayNote(day, calendar, venue.id)?.text ?? null) : null;
  const states = slotStates(
    slots,
    approved.data ?? [],
    waiting.data ?? [],
    selection,
    new Date(),
    closedReason,
  );

  const usingCustom = custom.from !== '' || custom.to !== '';
  const customProblem = usingCustom
    ? customTimesProblem(day, custom, approved.data ?? [], closedReason)
    : null;
  const run = freeRun(selection, states);
  const chosen = run
    ? selectionTimes(slots, run)
    : usingCustom && !customProblem
      ? { start: atSchoolTime(day, custom.from), end: atSchoolTime(day, custom.to) }
      : null;

  function clearChoice() {
    setSelection(null);
    setCustom(noCustomTimes);
  }

  function chooseVenue(id: string) {
    setSearchParams({ venue: id }, { replace: true });
    clearChoice();
  }

  function changeWeek(offset: number) {
    const nextDays = schoolDaysOfWeek(offset, settings);
    setWeekOffset(offset);
    setDay(firstDay(nextDays) ?? nextDays[0]);
    clearChoice();
  }

  function togglePeriod(index: number) {
    setCustom(noCustomTimes);
    setSelection(nextSelection(selection, index, states));
  }

  function changeCustom(changes: Partial<CustomTimes>) {
    setSelection(null);
    setCustom((current) => ({ ...current, ...changes }));
  }

  function request() {
    if (!chosen) return;
    const params = new URLSearchParams({
      venue: venue.id,
      start: chosen.start.toISOString(),
      end: chosen.end.toISOString(),
    });
    navigate(`/book/request?${params}`);
  }

  const caption = !venue.needs_approval
    ? "This venue doesn't need approval: free periods are booked straight away."
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
          clearChoice();
        }}
        canGoBack={weekOffset > 0}
        onPreviousWeek={() => changeWeek(weekOffset - 1)}
        onNextWeek={() => changeWeek(weekOffset + 1)}
        dayNoteFor={(d) =>
          dayNote(d, calendar, venue.id)?.text ??
          (buildSlots(d, periods).length === 0 ? 'No periods' : null)
        }
        // Holidays stay selectable, so you can see that day's periods are
        // closed; only days without any periods are greyed out.
        isDisabled={(d) => buildSlots(d, periods).length === 0}
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
      {slots.length === 0 ? (
        <EmptyState icon="calendar" title="No periods this day" />
      ) : approved.isPending ? (
        <LoadingState shape="slot" />
      ) : (
        <>
          {closedReason && (
            <p className={styles.closed} role="status">
              {closedReason}. Nothing can be booked this day.
            </p>
          )}
          <PeriodList slots={slots} states={states} onToggle={togglePeriod} />
        </>
      )}

      {allowCustomTimes && slots.length > 0 && !closedReason && (
        <Card as="section" className="stack-tight" aria-labelledby="custom-time-heading">
          <h3 id="custom-time-heading">Another time</h3>
          <p className="meta">For times that aren't periods, e.g. after school.</p>
          <FieldRow>
            <TextField
              label="From"
              type="time"
              value={custom.from}
              onChange={(e) => changeCustom({ from: e.target.value })}
            />
            <TextField
              label="Until"
              type="time"
              value={custom.to}
              onChange={(e) => changeCustom({ to: e.target.value })}
            />
          </FieldRow>
          {customProblem && (
            <p className={styles.problem} role="status">
              {customProblem}
            </p>
          )}
        </Card>
      )}

      <div className={styles.footer}>
        <Button fullWidth disabled={!chosen} onClick={request}>
          {chosen
            ? `Request ${formatTimeRange(chosen.start, chosen.end)}`
            : allowCustomTimes
              ? 'Choose periods or a time'
              : 'Choose free periods'}
        </Button>
        <p className="meta">{caption}</p>
      </div>
    </div>
  );
}
