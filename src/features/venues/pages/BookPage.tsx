// Book a venue (reference screen 4; design PDF page 7, "Book by the bell"):
// the venue is the large title (tap it to choose another), then a day, then
// the timetable: tap a run of free periods and the floating bar shows the
// exact times, with one Request button. The list shows the chosen date's own
// periods, so a short Friday looks shorter. The calendar listens to Realtime,
// so an approval made elsewhere appears here at once.
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { DateStrip } from '@/components/DateStrip';
import { Icon } from '@/components/Icon';
import { FieldRow, TextField } from '@/components/Input';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { useFloors } from '@/features/map/hooks';
import type { Period } from '@/features/school/api';
import { useBlackouts, useHolidays, usePeriods, useTerms } from '@/features/school/hooks';
import { dayNote, schoolDaysOfWeek, type CalendarData } from '@/features/school/logic';
import { useAppSettings } from '@/features/settings/hooks';
import { atSchoolTime, dayLabels, dayRange, formatTimeRange } from '@/lib/dates';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { Venue } from '../api';
import { PeriodList } from '../components/PeriodList';
import { useApprovedBookings, useLiveBookings, useVenues, useWaitingRequests } from '../hooks';
import {
  buildSlots,
  customTimesProblem,
  firstBookableDay,
  freeRun,
  nextSelection,
  runLabel,
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
  const floors = useFloors();
  useLiveBookings();
  useDocumentTitle('Book a venue');

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
    ? 'Booked straight away: no approval needed'
    : user.role === 'student'
      ? 'Your supervising teacher confirms, then venue staff approve'
      : 'Confirmed after admin approval';

  // "320 seats · Floor G · needs approval"
  const floorName = floors.data?.find((f) => f.id === venue.room?.floor_id)?.name;
  const about = [
    venue.capacity ? `${venue.capacity} seats` : null,
    floorName ? `Floor ${floorName}` : null,
    venue.needs_approval ? 'needs approval' : 'no approval needed',
  ]
    .filter(Boolean)
    .join(' · ');

  // What the floating bar says: the run of periods (or custom time) and its times.
  const chosenLabel = chosen
    ? `${run ? runLabel(slots, run) : 'Your time'} · ${formatTimeRange(chosen.start, chosen.end)}`
    : allowCustomTimes
      ? 'Choose periods or a time'
      : 'Choose free periods';

  return (
    <div className={`stack ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.topRow}>
          <p className="label">Book a venue</p>
          <ButtonLink to="/book/mine" variant="secondary" size="small">
            My bookings
          </ButtonLink>
        </div>
        {/* The venue's name is the title; a real <select> sits over it, so
            tapping the title opens the phone's own picker. */}
        <div className={styles.venuePicker}>
          <h1 className={styles.venueName} aria-hidden="true">
            {venue.name}
            <Icon name="chevronDown" size={22} />
          </h1>
          <label htmlFor="venue-pick" className="visually-hidden">
            Venue
          </label>
          <select
            id="venue-pick"
            className={styles.venueSelect}
            value={venue.id}
            onChange={(event) => chooseVenue(event.target.value)}
          >
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <p className={styles.about}>{about}</p>
      </header>

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
          <PeriodList
            slots={slots}
            states={states}
            onToggle={togglePeriod}
            dayLabel={dayLabels(day).long}
          />
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

      {/* One next step (design PDF page 7): a floating bar with the exact
          times and one Request button, above the tab bar. */}
      <div className={`glass thick ${styles.bar}`} aria-live="polite">
        <div className={styles.barText}>
          <p className={chosen ? styles.barTimes : styles.barPrompt}>{chosenLabel}</p>
          <p className="meta">{caption}</p>
        </div>
        <Button
          variant="accent"
          disabled={!chosen}
          aria-label={chosen ? `Request ${chosenLabel}` : undefined}
          onClick={request}
        >
          Request
        </Button>
      </div>
    </div>
  );
}
