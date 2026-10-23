// People admin: the CSV import preview shows what's wrong with each row, and
// the CSV and user filters behave. (Every rule is enforced in the database:
// supabase/tests/10_people_test.sql.)
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdminUser, ImportResult } from './api';
import { ImportPreview } from './components/ImportPreview';
import {
  filterUsers,
  noUserFilters,
  rowsFromCsv,
  validateClass,
  validatePeriod,
  validateRange,
} from './logic';

const results: ImportResult[] = [
  {
    row_number: 1,
    email: 'new@school.example',
    full_name: 'New Student',
    outcome: 'create',
    message: 'Set up when they first sign in.',
  },
  {
    row_number: 2,
    email: 'outsider@gmail.com',
    full_name: 'Outsider',
    outcome: 'error',
    message: 'Not a school email address (must end in school.example).',
  },
  {
    row_number: 3,
    email: 'g9@school.example',
    full_name: 'Grade Nine',
    outcome: 'error',
    message: 'Unknown grade: 9.',
  },
];

describe('ImportPreview', () => {
  it('shows each row with its problem, and a summary', () => {
    render(<ImportPreview results={results} />);
    expect(screen.getByText('3 rows: 1 new · 0 to update · 2 with problems')).toBeInTheDocument();

    const rows = screen.getAllByRole('row').slice(1); // skip the heading row
    expect(within(rows[0]).getByText('New')).toBeInTheDocument();
    // Line numbers match the file: data row 2 is line 3 (line 1 is the headings).
    expect(within(rows[1]).getByText('3')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Problem')).toBeInTheDocument();
    expect(
      within(rows[1]).getByText('Not a school email address (must end in school.example).'),
    ).toBeInTheDocument();
    expect(within(rows[2]).getByText('Unknown grade: 9.')).toBeInTheDocument();
  });
});

describe('rowsFromCsv', () => {
  it('reads the template columns, in any order', () => {
    const parsed = rowsFromCsv('Email,Name,Grade\njo@school.example,Jo,10\n');
    expect(parsed).toEqual({
      rows: [{ name: 'Jo', email: 'jo@school.example', role: '', grade: '10', section: '' }],
    });
  });

  it('explains when the headings are missing', () => {
    expect(rowsFromCsv('Jo,jo@school.example\nAli,ali@school.example\n')).toEqual({
      problem: 'The first line must be the headings: name,email,role,grade,section',
    });
  });
});

describe('filterUsers', () => {
  const person = (overrides: Partial<AdminUser>): AdminUser => ({
    id: overrides.full_name ?? 'x',
    full_name: 'Someone',
    email: 'someone@dev.local',
    role: 'student',
    grade: 10,
    section: 'A',
    responsibilities: [],
    posting_suspended_until: null,
    suspension_reason: null,
    archived_at: null,
    created_at: '',
    ...overrides,
  });
  const users = [
    person({ full_name: 'Amira', grade: 8 }),
    person({ full_name: 'Ben', posting_suspended_until: '2030-01-01T00:00:00Z' }),
    person({ full_name: 'Chen', archived_at: '2026-06-30T00:00:00Z', grade: 12 }),
    person({ full_name: 'Teacher Dee', role: 'teacher', grade: null }),
  ];
  const names = (list: AdminUser[]) => list.map((u) => u.full_name);

  it('hides people who have left unless asked, and searches names', () => {
    expect(names(filterUsers(users, noUserFilters))).toEqual(['Amira', 'Ben', 'Teacher Dee']);
    expect(names(filterUsers(users, { ...noUserFilters, query: 'ben' }))).toEqual(['Ben']);
    expect(names(filterUsers(users, { ...noUserFilters, status: 'archived' }))).toEqual(['Chen']);
  });

  it('narrows by role, grade and suspension', () => {
    expect(names(filterUsers(users, { ...noUserFilters, role: 'teacher' }))).toEqual([
      'Teacher Dee',
    ]);
    expect(names(filterUsers(users, { ...noUserFilters, grade: '8' }))).toEqual(['Amira']);
    expect(names(filterUsers(users, { ...noUserFilters, status: 'suspended' }))).toEqual(['Ben']);
  });
});

describe('validateClass (create form)', () => {
  it('needs a name, a grade and a teacher', () => {
    expect(
      validateClass({
        name: '',
        subject: '',
        grade: '',
        sectionId: '',
        teacherIds: [],
        studentIds: [],
      }),
    ).toEqual({
      name: 'Name the class, e.g. 10 A Physics.',
      grade: 'Choose the grade.',
      teacherIds: 'Choose at least one teacher.',
    });
  });
});

describe('calendar forms', () => {
  it('needs a period that ends after it starts, on some day', () => {
    expect(
      validatePeriod({ name: 'P1', startsAt: '09:00', endsAt: '08:00', weekdays: [] }),
    ).toEqual({
      endsAt: 'It has to end after it starts.',
      weekdays: 'Choose at least one day.',
    });
  });

  it("won't take a range that ends before it starts", () => {
    expect(validateRange({ name: 'Break', startsOn: '2026-12-10', endsOn: '2026-12-01' })).toEqual({
      endsOn: "The last day can't be before the first.",
    });
    expect(
      validateRange({ name: 'Day off', startsOn: '2026-12-02', endsOn: '2026-12-02' }),
    ).toEqual({});
  });
});
