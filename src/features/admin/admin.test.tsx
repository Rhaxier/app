// Admin screens: form checks. Who may change roles, settings and the rest is
// enforced by the database (supabase/tests/01_identity_test.sql and others).
import { describe, expect, it } from 'vitest';
import type { AppSettings } from '@/features/settings/api';
import {
  toSettingsChanges,
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
  collab_requires_teacher: false,
  supw_hours_target: null,
  teachers_post_any_grade: true,
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
    expect(values.supwHoursTarget).toBe('');
    expect(validateSettings(values)).toEqual({});
  });

  it('catches a domain with an @, a broken pattern and odd numbers', () => {
    const errors = validateSettings({
      ...values,
      schoolEmailDomain: '@school.example',
      staffEmailPattern: '([a-z]',
    });
    expect(errors.schoolEmailDomain).toBe('Just the domain, e.g. school.example (no @).');
    expect(errors.staffEmailPattern).toBe("That pattern isn't valid.");
  });

  it('saves empty optional fields as null and numbers as numbers', () => {
    const changes = toSettingsChanges({
      ...values,
      schoolEmailDomain: ' School.Example ',
      supwHoursTarget: '60',
    });
    expect(changes.school_email_domain).toBe('school.example');
    expect(changes.staff_email_pattern).toBeNull();
    expect(changes.supw_hours_target).toBe(60);
    expect(changes.venue_reminder_hours).toBe(48);
  });
});

describe('venue and room forms', () => {
  it('needs a venue name and a whole-number capacity', () => {
    expect(
      validateVenue({ name: '', roomId: '', capacity: '2.5', needsApproval: true, active: true }),
    ).toEqual({
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
