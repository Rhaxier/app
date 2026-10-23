// SUPW volunteering: the UI's own logic. Permissions (who sees which event,
// one role per event, the cap per role, who confirms hours) are tested in the
// database: supabase/tests/04_volunteering_test.sql.
import { describe, expect, it } from 'vitest';
import type { MySignup, VolunteerEvent } from './api';
import {
  emptyEventValues,
  eventSpotsLeft,
  filledLabel,
  filterEvents,
  hoursSoFar,
  isSignupOpen,
  toEventInput,
  validateEvent,
  type EventFormValues,
} from './logic';

const now = new Date('2026-10-19T08:00:00Z'); // Monday, 12:00 in Dubai

function makeEvent(overrides: Partial<VolunteerEvent> = {}): VolunteerEvent {
  return {
    id: 'e1',
    creator_id: 'teacher-1',
    organiser_label: null,
    title: 'Beach clean-up',
    description: '',
    starts_at: '2026-10-21T03:00:00Z',
    ends_at: '2026-10-21T06:00:00Z',
    room_id: null,
    place_text: 'Main gate',
    supw_hours: 3,
    signup_deadline: null,
    allow_multiple_roles: false,
    status: 'published',
    approved_by: null,
    approval_note: null,
    created_at: '2026-10-01T00:00:00Z',
    category_id: null,
    creator: { full_name: 'Teacher A' },
    room: null,
    roles: [
      {
        id: 'r1',
        name: 'Desk',
        description: '',
        spots_wanted: 2,
        selected_count: 1,
        waitlisted_count: 0,
      },
      {
        id: 'r2',
        name: 'Photographer',
        description: '',
        spots_wanted: 1,
        selected_count: 1,
        waitlisted_count: 2,
      },
    ],
    ...overrides,
  };
}

function signup(overrides: Partial<MySignup>): MySignup {
  return {
    id: 's1',
    role_id: 'r1',
    event_id: 'e1',
    status: 'applied',
    note: null,
    attended: null,
    hours_confirmed: null,
    ...overrides,
  };
}

describe('spots', () => {
  it('counts the spots still open across roles', () => {
    expect(eventSpotsLeft(makeEvent())).toBe(1); // 1 left at the desk, photographer full
  });

  it('says how full a role is', () => {
    expect(filledLabel({ spots_wanted: 5, selected_count: 3 })).toBe('3 of 5 filled');
  });
});

describe('isSignupOpen', () => {
  it('is open for published, upcoming events before the deadline', () => {
    expect(isSignupOpen(makeEvent(), now)).toBe(true);
  });

  it('is closed after the deadline, once started, or before approval', () => {
    expect(isSignupOpen(makeEvent({ signup_deadline: '2026-10-19T07:00:00Z' }), now)).toBe(false);
    expect(isSignupOpen(makeEvent({ starts_at: '2026-10-19T07:00:00Z' }), now)).toBe(false);
    expect(isSignupOpen(makeEvent({ status: 'awaiting_approval' }), now)).toBe(false);
  });
});

describe('filterEvents', () => {
  const past = makeEvent({
    id: 'past',
    starts_at: '2026-10-01T05:00:00Z',
    ends_at: '2026-10-01T06:00:00Z',
  });
  const inSchool = makeEvent({
    id: 'school',
    room_id: 'room-1',
    starts_at: '2026-11-10T05:00:00Z',
    ends_at: '2026-11-10T06:00:00Z',
  });
  const thisWeek = makeEvent({ id: 'week' });
  const events = [past, inSchool, thisWeek];

  it('"All" hides finished events', () => {
    expect(filterEvents(events, 'all', [], 'me', now).map((e) => e.id)).toEqual(['school', 'week']);
  });

  it('"This week" and "In school" narrow the list', () => {
    expect(filterEvents(events, 'week', [], 'me', now).map((e) => e.id)).toEqual(['week']);
    expect(filterEvents(events, 'school', [], 'me', now).map((e) => e.id)).toEqual(['school']);
  });

  it('"Signed up" keeps past events you took part in, but not withdrawn ones', () => {
    const mine = [
      signup({ event_id: 'past', status: 'selected' }),
      signup({ event_id: 'week', status: 'withdrawn' }),
    ];
    expect(filterEvents(events, 'mine', mine, 'me', now).map((e) => e.id)).toEqual(['past']);
  });
});

describe('hoursSoFar', () => {
  it('adds up confirmed hours only', () => {
    expect(
      hoursSoFar([signup({ hours_confirmed: 3 }), signup({ hours_confirmed: 1.5 }), signup({})]),
    ).toBe(4.5);
  });
});

describe('validateEvent (create form)', () => {
  const valid: EventFormValues = {
    ...emptyEventValues,
    title: 'Food drive',
    startsAt: '2026-10-25T09:00',
    endsAt: '2026-10-25T12:00',
    placeKind: 'text',
    placeText: 'Cafeteria',
    roles: [{ name: 'Packing', description: '', spotsWanted: '5' }],
  };

  it('accepts a complete event', () => {
    expect(validateEvent(valid)).toEqual({});
  });

  it('catches missing fields', () => {
    const errors = validateEvent(emptyEventValues);
    expect(errors.title).toBe('Add a title.');
    expect(errors.startsAt).toBe('Choose when it starts.');
    expect(errors.place).toBe('Choose a room.');
    expect(errors.roleErrors?.[0]).toEqual({ name: 'Name this role.' });
  });

  it('needs the end after the start and the deadline before the start', () => {
    const errors = validateEvent({
      ...valid,
      endsAt: '2026-10-25T08:00',
      signupDeadline: '2026-10-26T08:00',
    });
    expect(errors.endsAt).toBe('The end must be after the start.');
    expect(errors.signupDeadline).toBe('The sign-up deadline must be before the event starts.');
  });

  it('needs at least one role, each wanting at least one student', () => {
    expect(validateEvent({ ...valid, roles: [] }).roles).toBe('Add at least one role.');
    expect(
      validateEvent({ ...valid, roles: [{ name: 'X', description: '', spotsWanted: '0' }] })
        .roleErrors?.[0],
    ).toEqual({ spotsWanted: 'At least 1.' });
  });

  it('sends either a room or a place, never both', () => {
    const input = toEventInput({ ...valid, roomId: 'room-1' });
    expect(input.room_id).toBeNull();
    expect(input.place_text).toBe('Cafeteria');
    expect(input.starts_at).toBe('2026-10-25T05:00:00.000Z'); // 09:00 Dubai
  });
});
