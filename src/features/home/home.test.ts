// Home: the counts and dots under the six tools.
import { describe, expect, it } from 'vitest';
import type { CollabPost } from '@/features/collab/api';
import type { Report } from '@/features/fixit/api';
import type { Floor } from '@/features/map/api';
import type { Project } from '@/features/projects/api';
import type { VolunteerEvent } from '@/features/volunteering/api';
import { toolHints } from './logic';

const now = new Date('2026-10-20T08:00:00+04:00');
const me = 'student-1';

// Only the fields toolHints reads; the rest of each row doesn't matter here.
const event = (startsAt: string, status = 'published') =>
  ({ status, starts_at: startsAt, signup_deadline: null }) as unknown as VolunteerEvent;
const project = (ownerId: string, status: string) =>
  ({ owner_id: ownerId, status }) as unknown as Project;
const post = (status: string, hiddenBy: string | null = null) =>
  ({ status, hidden_by: hiddenBy }) as unknown as CollabPost;
const report = (status: string) => ({ status }) as unknown as Report;

describe('toolHints', () => {
  it('describes each tool before its list has loaded', () => {
    const hints = toolHints({ userId: me, staff: false }, now);
    expect(hints.map).toEqual({ sub: 'Find a room' });
    expect(hints.volunteer).toEqual({ sub: 'SUPW' });
    expect(hints.report).toEqual({ sub: 'Fix-it' });
  });

  it('counts floors, open events and open teams', () => {
    const hints = toolHints(
      {
        userId: me,
        staff: false,
        floors: [{}, {}, {}] as Floor[],
        events: [event('2026-10-25T07:00:00+04:00'), event('2026-10-01T07:00:00+04:00')],
        posts: [post('open'), post('full'), post('open', 'teacher-1')],
      },
      now,
    );
    expect(hints.map.sub).toBe('3 floors');
    expect(hints.volunteer.sub).toBe('1 open');
    // Full and hidden posts aren't looking for anyone.
    expect(hints.collab.sub).toBe('1 team');
  });

  it("flags a student's new feedback in blue and open fix-it reports in orange", () => {
    const hints = toolHints(
      {
        userId: me,
        staff: false,
        projects: [project(me, 'feedback_given'), project(me, 'draft')],
        reports: [report('open'), report('in_progress'), report('resolved')],
      },
      now,
    );
    expect(hints.projects).toEqual({ sub: '1 note', dot: 'new' });
    expect(hints.report).toEqual({ sub: '2 open', dot: 'problem' });
  });

  it('shows staff the projects waiting for their review', () => {
    const hints = toolHints(
      {
        userId: 'teacher-1',
        staff: true,
        projects: [project(me, 'shared'), project(me, 'in_review'), project(me, 'complete')],
      },
      now,
    );
    expect(hints.projects).toEqual({ sub: '2 to review', dot: 'new' });
  });
});
