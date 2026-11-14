// Collab finder (reference screen 6; design PDF page 8): posts from every
// grade, filtered by skill with a row of chips that scrolls sideways.
import { useState } from 'react';
import { ChipGroup, FilterChip } from '@/components/Chip';
import { Fab } from '@/components/Fab';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { PostCard } from '../components/PostCard';
import { useMyRequests, usePosts } from '../hooks';
import { allSkills, filterBySkill, joinState } from '../logic';

export function CollabPage() {
  const user = useCurrentUser();
  const posts = usePosts();
  const myRequests = useMyRequests(user.id);
  const [skill, setSkill] = useState<string | null>(null);

  // Closed posts drop off the finder, except your own.
  const visible = (posts.data ?? []).filter(
    (post) => post.status !== 'closed' || post.owner_id === user.id,
  );
  const shown = filterBySkill(visible, skill);

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Across every grade"
        title="Collab finder"
        action={<Fab to="/collab/new" label="Post a project" />}
      />
      <ChipGroup className="scroll-row" label="Filter by skill">
        <FilterChip selected={skill === null} onClick={() => setSkill(null)}>
          All skills
        </FilterChip>
        {allSkills(visible).map((name) => (
          <FilterChip key={name} selected={skill === name} onClick={() => setSkill(name)}>
            {name}
          </FilterChip>
        ))}
      </ChipGroup>

      {posts.isPending && <LoadingState />}
      {posts.isError && <ErrorState error={posts.error} onRetry={() => posts.refetch()} />}
      {posts.data && shown.length === 0 && (
        <EmptyState icon="users" title="No posts here yet">
          Post your project to find teammates.
        </EmptyState>
      )}
      <div className="stack-tight stagger">
        {shown.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            state={joinState(
              post,
              myRequests.data?.find((r) => r.post_id === post.id),
              user.id,
            )}
          />
        ))}
      </div>
    </div>
  );
}
