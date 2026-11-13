// Home's data: it borrows each feature's own list hooks, so the counts under
// the tools come from the same cached lists those screens show (and opening a
// tool afterwards is instant).
import { useCurrentUser } from '@/features/auth/hooks';
import { usePosts } from '@/features/collab/hooks';
import { useReports } from '@/features/fixit/hooks';
import { useFloors } from '@/features/map/hooks';
import { useProjects } from '@/features/projects/hooks';
import { useEvents } from '@/features/volunteering/hooks';
import { isStaff } from '@/lib/permissions';
import { toolHints } from './logic';

export function useToolHints() {
  const user = useCurrentUser();
  return toolHints({
    userId: user.id,
    staff: isStaff(user),
    floors: useFloors().data,
    events: useEvents().data,
    projects: useProjects().data,
    posts: usePosts().data,
    reports: useReports().data,
  });
}
