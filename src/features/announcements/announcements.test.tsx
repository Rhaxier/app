// =============================================================================
// Announcements: UI tests (the last step in docs/features/announcements.md).
//
// What we test here, and what we don't:
//   * The PERMISSIONS are tested in the database (supabase/tests/
//     03_announcements_test.sql), because that's where they're enforced.
//   * Here we test the UI's own logic: form validation, converting form values
//     for the database, and what the card shows.
// Plain functions are tested directly; components are rendered with
// renderWithProviders and checked the way a person would use them (by label
// and role, not by CSS class).
// =============================================================================
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/features/auth/api';
import { makeUser, renderWithProviders, teacher } from '@/test/utils';
import type { Announcement } from './api';
import { AnnouncementCard } from './components/AnnouncementCard';
import { AnnouncementForm } from './components/AnnouncementForm';
import { audienceLabel } from './format';
import {
  emptyAnnouncementValues,
  toAnnouncementInput,
  validateAnnouncement,
  type AnnouncementFormValues,
} from './validation';

const admin = makeUser({ id: 'admin-1', role: 'admin', grade: null });

// The form reads the signed-in person; the test decides who that is.
let signedIn: CurrentUser = teacher;
vi.mock('@/features/auth/hooks', () => ({ useCurrentUser: () => signedIn }));
// The grade and section chips come from the school's structure (Admin >
// Grades and sections); give the form some. Teachers may post to any grade.
vi.mock('@/features/settings/hooks', () => ({
  useAppSettings: () => ({ data: { teachers_post_any_grade: true } }),
}));
vi.mock('@/features/school/hooks', () => ({
  useActiveGrades: () => [8, 9, 10],
  useSections: () => ({ data: [{ id: 's-10a', grade: 10, name: 'A' }] }),
  useClasses: () => ({ data: [] }),
}));

const valid: AnnouncementFormValues = {
  ...emptyAnnouncementValues,
  title: 'Trip forms due',
  grades: [8],
};

describe('validateAnnouncement', () => {
  it('accepts a teacher posting to grades', () => {
    expect(validateAnnouncement(valid, teacher)).toEqual({});
  });

  it('needs a title and, for grade posts, at least one grade', () => {
    const errors = validateAnnouncement(emptyAnnouncementValues, teacher);
    expect(errors.title).toBe('Add a title.');
    expect(errors.grades).toBe('Choose at least one grade or section.');
  });

  it('stops teachers posting school-wide or pinning (the database refuses it too)', () => {
    const errors = validateAnnouncement({ ...valid, audience: 'school', pinned: true }, teacher);
    expect(errors.audience).toBe('Only admins can post to the whole school.');
    expect(errors.pinned).toBe('Only admins can pin announcements.');
  });

  it('lets admins post school-wide and pin', () => {
    expect(validateAnnouncement({ ...valid, audience: 'school', pinned: true }, admin)).toEqual({});
  });
});

describe('toAnnouncementInput', () => {
  it('sends sections on their own: the database adds their grades', () => {
    const input = toAnnouncementInput({ ...valid, grades: [8], sectionIds: ['s-10a'] });
    expect(input.section_ids).toEqual(['s-10a']);
    expect(input.grades).toEqual([]);
  });

  it('drops the grade list for school-wide posts (the table requires it)', () => {
    const input = toAnnouncementInput({ ...valid, audience: 'school', grades: [8, 9] });
    expect(input.grades).toBeNull();
  });

  it('trims text and turns an empty "post as" into null', () => {
    const input = toAnnouncementInput({ ...valid, title: '  Hi  ', postedAs: '   ' });
    expect(input.title).toBe('Hi');
    expect(input.posted_as).toBeNull();
  });
});

describe('AnnouncementForm', () => {
  function renderForm(onSubmit = vi.fn()) {
    renderWithProviders(
      <AnnouncementForm
        initialValues={emptyAnnouncementValues}
        submitLabel="Post"
        cancelTo="/announcements"
        submitting={false}
        submitError={null}
        onSubmit={onSubmit}
      />,
    );
    return onSubmit;
  }

  it('shows errors next to the fields and does not submit', async () => {
    signedIn = teacher;
    const onSubmit = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByLabelText('Title')).toHaveAccessibleDescription('Add a title.');
    expect(screen.getByText('Choose at least one grade or section.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('hides the whole-school and pin options from teachers', () => {
    signedIn = teacher;
    renderForm();
    expect(screen.queryByRole('button', { name: 'Whole school' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Pin to the top/)).not.toBeInTheDocument();
  });

  it('shows them to admins', () => {
    signedIn = admin;
    renderForm();
    expect(screen.getByRole('button', { name: 'Whole school' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Pin to the top/)).toBeInTheDocument();
  });

  it('submits the typed values', async () => {
    signedIn = teacher;
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText('Title'), 'Trip forms due');
    await userEvent.click(screen.getByRole('button', { name: 'Grade 8' }));
    await userEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Trip forms due', audience: 'grades', grades: [8] }),
    );
  });

  it('can narrow a grade announcement to sections', async () => {
    signedIn = teacher;
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText('Title'), 'Lab coats');
    await userEvent.click(screen.getByRole('button', { name: '10A' }));
    await userEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ sectionIds: ['s-10a'] }));
  });
});

describe('AnnouncementCard', () => {
  const pinned: Announcement = {
    id: 'a1',
    title: 'Welcome',
    body: 'Hello everyone',
    posted_as: 'Admin office',
    audience: 'school',
    grades: null,
    section_ids: null,
    pinned: true,
    published_at: new Date().toISOString(),
    author_id: 'admin-1',
    author: { full_name: 'Admin Plain' },
  };

  it('labels pinned posts and links to the full announcement', () => {
    renderWithProviders(<AnnouncementCard announcement={pinned} />);
    expect(screen.getByText('Pinned · Admin office')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/announcements/a1');
  });

  it('falls back to the author name when there is no "post as"', () => {
    renderWithProviders(
      <AnnouncementCard announcement={{ ...pinned, posted_as: null, pinned: false }} />,
    );
    expect(screen.getByText('Admin Plain')).toBeInTheDocument();
  });

  it('describes the audience', () => {
    expect(audienceLabel({ audience: 'grades', grades: [10, 12] })).toBe('Grades 10, 12');
    expect(audienceLabel({ audience: 'grades', grades: [8] })).toBe('Grade 8');
    expect(audienceLabel({ audience: 'school', grades: null })).toBe('Whole school');
  });
});
