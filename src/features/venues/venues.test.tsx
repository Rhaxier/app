// Venue booking: the calendar's period logic and the request form's checks.
// Double bookings, clash rejection, who may approve, and bookings having to
// follow the bell times are tested in the database:
// supabase/tests/07_venues_test.sql and 17_bell_times_test.sql.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Period } from '@/features/school/api';
import type { BookingDetails, CalendarBooking } from './api';
import { PeriodList } from './components/PeriodList';
import {
  buildSlots,
  gapBetween,
  customTimesProblem,
  firstBookableDay,
  freeRun,
  nextSelection,
  periodsLabel,
  selectionTimes,
  slotStates,
  validateBooking,
  emptyBookingValues,
} from './logic';

// Five 90-minute periods from 7:30, Sunday to Thursday (as drawn in the mockup).
const periods: Period[] = ['07:30', '09:00', '10:30', '12:00', '13:30'].map((start, i) => ({
  id: `p${i + 1}`,
  name: `Period ${i + 1}`,
  starts_at: `${start}:00`,
  ends_at: `${['09:00', '10:30', '12:00', '13:30', '15:00'][i]}:00`,
  sort_order: i + 1,
  weekdays: [0, 1, 2, 3, 4],
}));

const day = '2026-10-20'; // a Tuesday
const slots = buildSlots(day, periods);
const morning = new Date('2026-10-20T02:00:00Z'); // 06:00 in Dubai, before any slot

function approved(title: string, start: string, end: string): CalendarBooking {
  return { id: title, venue_id: 'v1', title, starts_at: start, ends_at: end, status: 'approved' };
}

function waiting(title: string, start: string, end: string): BookingDetails {
  return {
    id: title,
    venue_id: 'v1',
    venue_name: 'Auditorium',
    requester_id: 'me',
    requester_name: 'Me',
    requester_role: 'teacher',
    supervising_teacher_id: null,
    supervising_teacher_name: null,
    title,
    purpose: '',
    expected_attendance: null,
    starts_at: start,
    ends_at: end,
    status: 'pending',
    reviewed_by: null,
    review_note: null,
    announce: false,
    created_at: start,
    overlaps_pending: 0,
  };
}

describe('buildSlots', () => {
  it("cuts the day into that weekday's periods, in Dubai time", () => {
    expect(slots.map((slot) => slot.start.toISOString())).toEqual([
      '2026-10-20T03:30:00.000Z', // 7:30
      '2026-10-20T05:00:00.000Z', // 9:00
      '2026-10-20T06:30:00.000Z', // 10:30
      '2026-10-20T08:00:00.000Z', // 12:00
      '2026-10-20T09:30:00.000Z', // 13:30
    ]);
  });
});

describe('breaks and lunch (the gaps in the timetable)', () => {
  // Monday in the 2026–27 timetable: Period 3 ends 10:05, Period 4 starts
  // 10:20 (a break); Period 6 ends 12:50, Period 7 starts 13:20 (lunch).
  const monday: Period[] = [
    ['Period 3', '09:15', '10:05'],
    ['Period 4', '10:20', '11:10'],
    ['Period 5', '11:10', '12:00'],
    ['Period 6', '12:00', '12:50'],
    ['Period 7', '13:20', '14:10'],
  ].map(([name, starts, ends], i) => ({
    ...periods[0],
    id: `m${i}`,
    name,
    starts_at: `${starts}:00`,
    ends_at: `${ends}:00`,
    sort_order: i,
    weekdays: [1],
  }));
  const day = buildSlots('2026-10-19', monday);

  it('names a 15-minute gap a break and a 30-minute one lunch, with times', () => {
    expect(gapBetween(day[0], day[1])).toMatchObject({ label: 'Break' });
    expect(gapBetween(day[3], day[4])).toMatchObject({ label: 'Lunch' });
    expect(gapBetween(day[3], day[4])?.start.toISOString()).toBe('2026-10-19T08:50:00.000Z');
  });

  it('draws no line between periods that run on', () => {
    expect(gapBetween(day[1], day[2])).toBeNull();
  });
});

describe('buildSlots on a short day', () => {
  it('uses only the periods that run that weekday', () => {
    const shortFriday: Period = { ...periods[0], id: 'f1', weekdays: [5] };
    expect(buildSlots('2026-10-23', [...periods, shortFriday]).map((s) => s.name)).toEqual([
      'Period 1',
    ]);
    expect(buildSlots('2026-10-24', periods)).toEqual([]); // a Saturday: no periods
  });
});

describe('firstBookableDay', () => {
  const week = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'];

  it('opens on today while a slot is still ahead', () => {
    expect(firstBookableDay(week, periods, morning)).toBe('2026-10-20');
  });

  it('moves to the next school day after the last slot has started', () => {
    const evening = new Date('2026-10-20T14:00:00Z'); // 18:00 in Dubai
    expect(firstBookableDay(week, periods, evening)).toBe('2026-10-21');
  });

  it('skips holidays and blackouts', () => {
    const blocked = (day: string) => day === '2026-10-20';
    expect(firstBookableDay(week, periods, morning, blocked)).toBe('2026-10-21');
  });

  it('finds nothing once the week is over', () => {
    expect(firstBookableDay(week, periods, new Date('2026-10-23T08:00:00Z'))).toBeUndefined();
  });
});

describe('slotStates (the slot list states)', () => {
  const states = slotStates(
    slots,
    [approved('Grade 10 assembly', '2026-10-20T05:00:00Z', '2026-10-20T06:30:00Z')],
    [waiting('Drama rehearsal', '2026-10-20T08:00:00Z', '2026-10-20T09:30:00Z')],
    { first: 2, last: 2 },
    morning,
  );

  it('marks booked, pending, selected and available slots like the mockup', () => {
    expect(states.map((state) => state.kind)).toEqual([
      'available',
      'booked',
      'selected',
      'waiting',
      'available',
    ]);
  });

  it('counts a booking that only partly covers a slot as booked', () => {
    const partly = slotStates(
      slots,
      [approved('Setup', '2026-10-20T03:00:00Z', '2026-10-20T04:00:00Z')],
      [],
      null,
      morning,
    );
    expect(partly[0].kind).toBe('booked');
    expect(partly[1].kind).toBe('available');
  });

  it('treats a booking ending exactly when a slot starts as no clash', () => {
    const touching = slotStates(
      slots,
      [approved('Early', '2026-10-20T02:00:00Z', '2026-10-20T03:30:00Z')],
      [],
      null,
      morning,
    );
    expect(touching[0].kind).toBe('available');
  });

  it('greys out slots that have already started', () => {
    const noon = new Date('2026-10-20T08:30:00Z'); // 12:30 in Dubai
    expect(slotStates(slots, [], [], null, noon).map((s) => s.kind)).toEqual([
      'past',
      'past',
      'past',
      'past',
      'available',
    ]);
  });
});

describe('nextSelection', () => {
  const free = slotStates(slots, [], [], null, morning);
  const withBooking = slotStates(
    slots,
    [approved('Busy', '2026-10-20T06:30:00Z', '2026-10-20T08:00:00Z')],
    [],
    null,
    morning,
  );

  it('starts, extends and shrinks a run of neighbouring slots', () => {
    let selection = nextSelection(null, 1, free);
    expect(selection).toEqual({ first: 1, last: 1 });
    selection = nextSelection(selection, 2, free);
    expect(selection).toEqual({ first: 1, last: 2 });
    selection = nextSelection(selection, 0, free);
    expect(selection).toEqual({ first: 0, last: 2 });
    selection = nextSelection(selection, 2, free);
    expect(selection).toEqual({ first: 0, last: 1 });
    expect(selectionTimes(slots, selection!).end.toISOString()).toBe('2026-10-20T06:30:00.000Z');
  });

  it('starts again when tapping a slot that is not next to the selection', () => {
    expect(nextSelection({ first: 0, last: 0 }, 3, free)).toEqual({ first: 3, last: 3 });
  });

  it('clears a single selected slot when tapped again', () => {
    expect(nextSelection({ first: 1, last: 1 }, 1, free)).toBeNull();
  });

  it('ignores taps on booked slots', () => {
    expect(nextSelection({ first: 1, last: 1 }, 2, withBooking)).toEqual({ first: 1, last: 1 });
  });
});

describe('PeriodList', () => {
  it('shows each period by name and state, and lets free ones be picked', async () => {
    const states = slotStates(
      slots,
      [approved('Grade 10 assembly', '2026-10-20T05:00:00Z', '2026-10-20T06:30:00Z')],
      [waiting('Drama rehearsal', '2026-10-20T08:00:00Z', '2026-10-20T09:30:00Z')],
      { first: 2, last: 2 },
      morning,
    );
    const onToggle = vi.fn();
    render(<PeriodList slots={slots} states={states} onToggle={onToggle} />);
    expect(screen.getByText('Period 4')).toBeInTheDocument();
    expect(screen.getByText('Booked · until 10:30')).toBeInTheDocument();
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Period 3, 10:30–12:00, selected' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Period 3 · 10:30–12:00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Period 1, 7:30–9:00, available' }));
    expect(onToggle).toHaveBeenCalledWith(0);
    // Booked and pending periods are not buttons.
    expect(screen.queryByRole('button', { name: /Period 2/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Period 4/ })).not.toBeInTheDocument();
  });

  it('shows every period of a holiday as not bookable, with nothing to pick', () => {
    const states = slotStates(slots, [], [], null, morning, 'Holiday: Mid-term break');
    render(<PeriodList slots={slots} states={states} onToggle={vi.fn()} />);
    expect(screen.getAllByText('Not bookable')).toHaveLength(5);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('booking by periods', () => {
  // Period 3 (index 2) is taken; 1, 2, 4 and 5 are free.
  const taken = slotStates(
    slots,
    [approved('Busy', '2026-10-20T06:30:00Z', '2026-10-20T08:00:00Z')],
    [],
    null,
    morning,
  );
  const pending = slotStates(
    slots,
    [],
    [waiting('Someone else', '2026-10-20T06:30:00Z', '2026-10-20T08:00:00Z')],
    null,
    morning,
  );

  it('blocks a run that would cross a booked period: tapping past it starts a new run', () => {
    let selection = nextSelection(null, 0, taken);
    selection = nextSelection(selection, 1, taken);
    expect(selection).toEqual({ first: 0, last: 1 });
    // Period 3 is booked: tapping it does nothing.
    expect(nextSelection(selection, 2, taken)).toEqual({ first: 0, last: 1 });
    // Period 4 is free but not next to the run: a new run starts there.
    expect(nextSelection(selection, 3, taken)).toEqual({ first: 3, last: 3 });
  });

  it('blocks a run that would cross a pending period the same way', () => {
    const selection = nextSelection({ first: 0, last: 1 }, 3, pending);
    expect(selection).toEqual({ first: 3, last: 3 });
  });

  it("won't request a run once a period in it stops being free", () => {
    const picked = slotStates(slots, [], [], { first: 1, last: 3 }, morning);
    expect(freeRun({ first: 1, last: 3 }, picked)).toEqual({ first: 1, last: 3 });
    // Someone's request for Period 3 arrives over Realtime.
    const now = slotStates(
      slots,
      [],
      [waiting('Someone else', '2026-10-20T06:30:00Z', '2026-10-20T08:00:00Z')],
      { first: 1, last: 3 },
      morning,
    );
    expect(freeRun({ first: 1, last: 3 }, now)).toBeNull();
  });

  it('closes every period of a holiday, but still shows bookings already made', () => {
    const states = slotStates(
      slots,
      [
        approved(
          'Booked before the holiday was added',
          '2026-10-20T03:30:00Z',
          '2026-10-20T05:00:00Z',
        ),
      ],
      [],
      null,
      morning,
      'Holiday: Mid-term break',
    );
    expect(states.map((state) => state.kind)).toEqual([
      'booked',
      'closed',
      'closed',
      'closed',
      'closed',
    ]);
    expect(nextSelection(null, 1, states)).toBeNull();
  });

  it("runs from the first period's start to the last one's end, and names them", () => {
    const times = selectionTimes(slots, { first: 1, last: 2 });
    expect(times.start.toISOString()).toBe('2026-10-20T05:00:00.000Z'); // 9:00
    expect(times.end.toISOString()).toBe('2026-10-20T08:00:00.000Z'); // 12:00
    expect(periodsLabel(times.start, times.end, periods)).toBe('Period 2 to Period 3');
    expect(periodsLabel(slots[0].start, slots[0].end, periods)).toBe('Period 1');
    // 9:00–11:00 isn't on the bell times: a custom time.
    expect(periodsLabel(times.start, new Date('2026-10-20T07:00:00Z'), periods)).toBeNull();
  });
});

describe('customTimesProblem', () => {
  const busy = [approved('Assembly', '2026-10-20T11:00:00Z', '2026-10-20T12:00:00Z')]; // 15:00–16:00

  it('needs both times, the end after the start', () => {
    expect(customTimesProblem(day, { from: '15:30', to: '' }, [], null, morning)).toBe(
      'Choose a start and an end time.',
    );
    expect(customTimesProblem(day, { from: '17:00', to: '16:00' }, [], null, morning)).toBe(
      'The end must be after the start.',
    );
  });

  it('refuses a clash with an approved booking, and a closed day', () => {
    expect(customTimesProblem(day, { from: '15:30', to: '17:00' }, busy, null, morning)).toBe(
      'Clashes with "Assembly" (15:00–16:00).',
    );
    expect(
      customTimesProblem(day, { from: '16:00', to: '17:00' }, [], 'Holiday: Eid', morning),
    ).toBe('Holiday: Eid');
  });

  it('accepts a free time after school', () => {
    expect(customTimesProblem(day, { from: '16:00', to: '17:30' }, busy, null, morning)).toBeNull();
  });
});

describe('validateBooking (request form)', () => {
  it('needs a title, and a supervising teacher for students', () => {
    expect(validateBooking(emptyBookingValues, { isStudent: true, capacity: null })).toEqual({
      title: 'Say what the booking is for.',
      supervisingTeacherId: 'Students need a teacher to supervise.',
    });
    expect(
      validateBooking(
        { ...emptyBookingValues, title: 'Rehearsal' },
        { isStudent: false, capacity: null },
      ),
    ).toEqual({});
  });

  it('keeps attendance within the venue capacity', () => {
    const errors = validateBooking(
      { ...emptyBookingValues, title: 'Fair', expectedAttendance: '400' },
      { isStudent: false, capacity: 300 },
    );
    expect(errors.expectedAttendance).toBe('This venue holds up to 300 people.');
  });
});
