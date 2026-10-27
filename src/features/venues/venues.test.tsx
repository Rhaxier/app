// Venue booking: the calendar's slot logic and the request form's checks.
// Double bookings, clash rejection and who may approve are tested in the
// database: supabase/tests/07_venues_test.sql.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Period } from '@/features/school/api';
import type { BookingDetails, CalendarBooking } from './api';
import { SlotList } from './components/SlotList';
import {
  buildSlots,
  firstBookableDay,
  nextSelection,
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

describe('SlotList', () => {
  it('shows each state and lets free slots be picked', async () => {
    const states = slotStates(
      slots,
      [approved('Grade 10 assembly', '2026-10-20T05:00:00Z', '2026-10-20T06:30:00Z')],
      [waiting('Drama rehearsal', '2026-10-20T08:00:00Z', '2026-10-20T09:30:00Z')],
      { first: 2, last: 2 },
      morning,
    );
    const onToggle = vi.fn();
    render(<SlotList slots={slots} states={states} onToggle={onToggle} />);
    expect(screen.getByText('Booked · until 10:30')).toBeInTheDocument();
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10:30–12:00, selected' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: '7:30–9:00, available' }));
    expect(onToggle).toHaveBeenCalledWith(0);
    // Booked and pending slots are not buttons.
    expect(screen.queryByRole('button', { name: /9:00–10:30/ })).not.toBeInTheDocument();
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
