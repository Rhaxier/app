// Collab finder: the UI's own logic. The auto-close rule and who can read
// requester emails are tested in the database: supabase/tests/06_collab_test.sql.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import type { CollabPost, MyRequest } from './api';
import { CollabForm } from './components/CollabForm';
import {
  allSkills,
  emptyCollabValues,
  filledLabel,
  openLabel,
  filterBySkill,
  joinState,
  parseSkills,
  spotsLeft,
  toPostInput,
  validateCollab,
} from './logic';

// The form's teacher picker loads staff names; give it a fixed list.
vi.mock('@/features/people/hooks', () => ({
  useStaff: () => ({
    isPending: false,
    data: [{ id: 't1', full_name: 'Teacher A', role: 'teacher' }],
  }),
}));

function makePost(overrides: Partial<CollabPost> = {}): CollabPost {
  return {
    id: 'c1',
    owner_id: 'owner',
    title: 'Line-following robot',
    description: '',
    skills: ['CAD', 'Soldering'],
    spots_wanted: 3,
    status: 'open',
    supervising_teacher_id: null,
    hidden_by: null,
    hidden_reason: null,
    created_at: '2026-10-17T00:00:00Z',
    owner: { full_name: 'Student Grade 10 A', grade: 10, avatar_initials: null },
    supervisor: null,
    accepted_count: 2,
    pending_count: 1,
    ...overrides,
  };
}

describe('"x of y filled"', () => {
  it('counts accepted students against the number wanted', () => {
    expect(filledLabel(makePost())).toBe('2 of 3 spots filled');
    expect(spotsLeft(makePost())).toBe(1);
  });

  it('says how many spots are still open, for the dots on a post', () => {
    expect(openLabel(makePost())).toBe('1 of 3 spots open');
    expect(openLabel(makePost({ spots_wanted: 1, accepted_count: 0 }))).toBe('1 of 1 spot open');
    expect(openLabel(makePost({ spots_wanted: 2, accepted_count: 3 }))).toBe('0 of 2 spots open');
  });

  it('uses the singular for one spot and never shows more filled than wanted', () => {
    expect(filledLabel(makePost({ spots_wanted: 1, accepted_count: 0 }))).toBe(
      '0 of 1 spot filled',
    );
    // e.g. after the owner lowers the number (the database stops this, but stay safe)
    expect(filledLabel(makePost({ spots_wanted: 2, accepted_count: 3 }))).toBe(
      '2 of 2 spots filled',
    );
    expect(spotsLeft(makePost({ spots_wanted: 2, accepted_count: 3 }))).toBe(0);
  });
});

describe('skills', () => {
  it('collects each skill once for the filter chips, ignoring case', () => {
    const posts = [makePost(), makePost({ skills: ['cad', 'Writing'] })];
    expect(allSkills(posts)).toEqual(['CAD', 'Soldering', 'Writing']);
  });

  it('filters posts by skill, ignoring case', () => {
    const posts = [makePost({ id: 'a' }), makePost({ id: 'b', skills: ['Writing'] })];
    expect(filterBySkill(posts, 'cad').map((p) => p.id)).toEqual(['a']);
    expect(filterBySkill(posts, null)).toHaveLength(2);
  });

  it('parses the comma-separated skills field', () => {
    expect(parseSkills('CAD, Soldering ,  , cad, 3D printing')).toEqual([
      'CAD',
      'Soldering',
      '3D printing',
    ]);
  });
});

describe('joinState', () => {
  const request = (status: MyRequest['status']): MyRequest => ({
    id: 'r',
    post_id: 'c1',
    status,
    message: '',
  });

  it('tells owners, requesters and team members apart', () => {
    expect(joinState(makePost(), undefined, 'owner')).toBe('own');
    expect(joinState(makePost(), undefined, 'me')).toBe('can_ask');
    expect(joinState(makePost(), request('pending'), 'me')).toBe('requested');
    expect(joinState(makePost(), request('accepted'), 'me')).toBe('on_team');
    expect(joinState(makePost(), request('declined'), 'me')).toBe('declined');
  });

  it('stops new requests on full or closed posts', () => {
    expect(joinState(makePost({ status: 'full' }), undefined, 'me')).toBe('full');
    expect(joinState(makePost({ status: 'closed' }), undefined, 'me')).toBe('closed');
  });
});

describe('collab form validation', () => {
  const valid = { ...emptyCollabValues, title: 'Podcast', skills: 'Audio editing' };

  it('needs a title, a skill and a sensible number of people', () => {
    const errors = validateCollab({ ...emptyCollabValues, spotsWanted: '0' }, false, 0, 8);
    expect(errors).toEqual({
      title: 'Add a title.',
      skills: 'Choose at least one skill you need.',
      spotsWanted: 'Between 1 and 7 people (teams are up to 8, including you).',
    });
  });

  it("keeps teams within the school's maximum size", () => {
    expect(validateCollab({ ...valid, spotsWanted: '8' }, false, 0, 8).spotsWanted).toBeDefined();
    expect(validateCollab({ ...valid, spotsWanted: '7' }, false, 0, 8)).toEqual({});
  });

  it('cannot shrink below the people already accepted', () => {
    expect(validateCollab({ ...valid, spotsWanted: '1' }, false, 2).spotsWanted).toBe(
      '2 people are already on the team.',
    );
  });

  it('requires a teacher only when the school setting says so (Q4)', () => {
    expect(validateCollab(valid, false)).toEqual({});
    expect(validateCollab(valid, true).supervisingTeacherId).toBe('Choose a supervising teacher.');
  });

  it('turns the form into a post', () => {
    expect(toPostInput({ ...valid, skills: 'CAD, Soldering', spotsWanted: '3' })).toEqual({
      title: 'Podcast',
      description: '',
      skills: ['CAD', 'Soldering'],
      spots_wanted: 3,
      supervising_teacher_id: null,
    });
  });

  it('shows the required teacher error in the form', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <CollabForm
        initialValues={valid}
        teacherRequired
        submitLabel="Post"
        cancelTo="/collab"
        submitting={false}
        submitError={null}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(screen.getByText('Choose a supervising teacher.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByLabelText('Supervising teacher'), 't1');
    await userEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ supervisingTeacherId: 't1' }));
  });
});
