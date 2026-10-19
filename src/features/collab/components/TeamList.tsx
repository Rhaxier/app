// The team: the owner plus everyone accepted, with school emails. Visible to
// the team and staff (collab_team() in the migration checks).
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { ErrorState, LoadingState } from '@/components/States';
import { useTeam } from '../hooks';
import styles from './TeamList.module.css';

export function TeamList({ postId }: { postId: string }) {
  const team = useTeam(postId, true);
  if (team.isPending) return <LoadingState label="Loading team…" />;
  if (team.isError) return <ErrorState error={team.error} onRetry={() => team.refetch()} />;
  return (
    <Card as="section" className={styles.list}>
      {team.data.map((member) => (
        <div key={member.user_id} className={styles.member}>
          <Avatar name={member.full_name} size="small" tone={member.is_owner ? 'ink' : 'accent'} />
          <div className={styles.text}>
            <p className={styles.name}>
              {member.full_name}
              {member.is_owner && <span className="meta"> · owner</span>}
            </p>
            <a href={`mailto:${member.email}`} className="meta">
              {member.email}
            </a>
          </div>
        </div>
      ))}
    </Card>
  );
}
