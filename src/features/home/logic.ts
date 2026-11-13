// Home: the small line under each tool on Home ("3 floors", "4 open") and the
// dot that flags something new (blue) or broken (orange), as on the Home
// mockup (design PDF page 6). Plain functions, tested in home.test.ts.
import type { CollabPost } from '@/features/collab/api';
import { isOpen } from '@/features/fixit/logic';
import type { Report } from '@/features/fixit/api';
import type { Floor } from '@/features/map/api';
import type { Project } from '@/features/projects/api';
import type { VolunteerEvent } from '@/features/volunteering/api';
import { isSignupOpen } from '@/features/volunteering/logic';

export type ToolKey = 'map' | 'volunteer' | 'projects' | 'book' | 'collab' | 'report';

export interface ToolHint {
  /** The small grey line under the tool's name. */
  sub: string;
  /** new = something for you (blue dot); problem = something broken (orange dot). */
  dot?: 'new' | 'problem';
}

export interface ToolData {
  userId: string;
  staff: boolean;
  floors?: Floor[];
  events?: VolunteerEvent[];
  projects?: Project[];
  posts?: CollabPost[];
  reports?: Report[];
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** What to say under each tool. Until a list has loaded, a plain description. */
export function toolHints(data: ToolData, now: Date = new Date()): Record<ToolKey, ToolHint> {
  const { userId, staff, floors, events, projects, posts, reports } = data;

  const openEvents = events?.filter((event) => isSignupOpen(event, now)).length;
  const openTeams = posts?.filter((post) => post.status === 'open' && !post.hidden_by).length;
  const openReports = reports?.filter((report) => isOpen(report.status)).length;

  // Students: projects with a teacher's feedback waiting. Staff: work to review.
  const projectsNeedingYou = staff
    ? projects?.filter((p) => p.owner_id !== userId && ['shared', 'in_review'].includes(p.status))
        .length
    : projects?.filter((p) => p.owner_id === userId && p.status === 'feedback_given').length;

  return {
    map: { sub: floors ? count(floors.length, 'floor', 'floors') : 'Find a room' },
    volunteer: { sub: openEvents !== undefined ? `${openEvents} open` : 'SUPW' },
    projects: projectsNeedingYou
      ? {
          sub: staff
            ? `${projectsNeedingYou} to review`
            : count(projectsNeedingYou, 'note', 'notes'),
          dot: 'new',
        }
      : { sub: 'With teachers' },
    book: { sub: 'By period' },
    collab: { sub: openTeams !== undefined ? count(openTeams, 'team', 'teams') : 'Find a team' },
    report: openReports ? { sub: `${openReports} open`, dot: 'problem' } : { sub: 'Fix-it' },
  };
}
