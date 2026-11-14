// Admin screens: form checks. Who may change roles, settings and the rest is
// enforced by the database (supabase/tests/01_identity_test.sql and others).
import { describe, expect, it } from 'vitest';
import type { AppSettings } from '@/features/settings/api';
import {
  categoryKey,
  toSettingsChanges,
  validateReportCategory,
  validateRoom,
  validateSettings,
  validateStaffEmail,
  validateVenue,
  valuesFromSettings,
} from './logic';

const settings: AppSettings = {
  id: true,
  school_name: '[SCHOOL NAME]',
  school_email_domain: null,
  allow_dev_accounts: true,
  staff_email_pattern: null,
  students_can_request_venues: true,
  after_school_block_minutes: 30,
  after_school_until: '18:00:00',
  allow_custom_booking_times: false,
  collab_requires_teacher: false,
  teachers_post_any_grade: true,
  announcement_default_expiry_days: null,
  collab_max_team_size: 8,
  report_auto_urgent_votes: 5,
  student_events_need_approval: true,
  digest_time: '07:00:00',
  digest_last_sent_on: null,
  accent_color: '#0e6857',
  logo_url: null,
  maintenance_enabled: false,
  maintenance_message: null,
  maintenance_until: null,
  venue_reminder_hours: 48,
  venue_reminder_days_before: 3,
  school_days: [0, 1, 2, 3, 4],
  created_at: '',
  updated_at: '',
};

describe('validateStaffEmail', () => {
  it('needs a full address that is not already listed', () => {
    expect(validateStaffEmail('teacher', [])).toBe('Enter a full email address.');
    expect(validateStaffEmail('Teacher.A@school.example', ['teacher.a@school.example'])).toBe(
      'That email is already on the list.',
    );
    expect(validateStaffEmail('new.teacher@school.example', [])).toBeNull();
  });
});

describe('settings form', () => {
  const values = valuesFromSettings(settings);

  it('starts from the saved settings', () => {
    expect(values.schoolEmailDomain).toBe('');
    expect(validateSettings(values)).toEqual({});
  });

  it('catches a domain with an @ and a broken pattern', () => {
    const errors = validateSettings({
      ...values,
      schoolEmailDomain: '@school.example',
      staffEmailPattern: '([a-z]',
    });
    expect(errors.schoolEmailDomain).toBe('Just the domain, e.g. school.example (no @).');
    expect(errors.staffEmailPattern).toBe("That pattern isn't valid.");
  });

  it('saves the domain in lower case and empty optional fields as null', () => {
    const changes = toSettingsChanges({ ...values, schoolEmailDomain: ' School.Example ' });
    expect(changes.school_email_domain).toBe('school.example');
    expect(changes.staff_email_pattern).toBeNull();
  });
});

const noLimits = {
  name: 'Hall',
  roomId: '',
  capacity: '',
  needsApproval: true,
  active: true,
  bookableFrom: '',
  bookableUntil: '',
  maxMinutes: '',
  maxDaysAhead: '',
};

describe('venue and room forms', () => {
  it('checks the booking limits make sense, and allows none', () => {
    expect(validateVenue(noLimits)).toEqual({});
    expect(
      validateVenue({
        ...noLimits,
        bookableFrom: '18:00',
        bookableUntil: '07:00',
        maxMinutes: '5',
      }),
    ).toEqual({
      bookableUntil: 'It has to be after the earliest start.',
      maxMinutes: 'From 15 to 1440 minutes, or empty for no limit.',
    });
  });

  it('needs a venue name and a whole-number capacity', () => {
    expect(validateVenue({ ...noLimits, name: '', capacity: '2.5' })).toEqual({
      name: 'Name the venue.',
      capacity: 'A whole number of people.',
    });
  });

  it('keeps room codes unique', () => {
    expect(validateRoom({ code: 'g.14', name: 'Lab' }, ['G.14'])).toEqual({
      code: 'Another room has that code.',
    });
    expect(validateRoom({ code: '', name: '' }, [])).toEqual({
      code: 'Give the room a code, e.g. G.14.',
      name: 'Name the room.',
    });
  });
});

describe('fix-it category keys', () => {
  it('turns the name into a lasting key, never reusing one', () => {
    expect(categoryKey('Projector screen', [])).toBe('projector_screen');
    expect(categoryKey('IT', ['it'])).toBe('it_2');
    expect(validateReportCategory('it', [{ id: 'x', name: 'IT' }], null)).toBe(
      'There is already a category with that name.',
    );
  });
});
