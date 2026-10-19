// One post in the Collab finder (reference screen 6): who posted it, their
// grade, what they're building, the skills they need, how full the team is,
// and "Ask to join".
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { ButtonLink } from '@/components/Button';
import { Card } from '@/components/Card';
import { Tag } from '@/components/Chip';
import { relativeTime } from '@/lib/dates';
import type { CollabPost } from '../api';
import { filledLabel, type JoinState } from '../logic';
import styles from './PostCard.module.css';

const stateBadge: Partial<
  Record<JoinState, { label: string; tone: 'good' | 'attention' | 'quiet' }>
> = {
  own: { label: 'Your post', tone: 'quiet' },
  requested: { label: 'Requested', tone: 'attention' },
  on_team: { label: 'On the team', tone: 'good' },
  full: { label: 'Full', tone: 'quiet' },
  closed: { label: 'Closed', tone: 'quiet' },
};

export function PostCard({ post, state }: { post: CollabPost; state: JoinState }) {
  const owner = post.owner?.full_name ?? 'Student';
  const badge = post.hidden_by
    ? { label: 'Hidden for review', tone: 'attention' as const }
    : stateBadge[state];

  return (
    <Card as="article" className={styles.card}>
      <div className={styles.header}>
        <Avatar name={owner} initials={post.owner?.avatar_initials} tone="accent" />
        <div className={styles.who}>
          <p className={styles.name}>{owner}</p>
          <p className="meta">
            {post.owner?.grade ? `Grade ${post.owner.grade} · ` : ''}
            {relativeTime(post.created_at)}
          </p>
        </div>
        {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
      </div>

      <h3>
        <Link to={`/collab/${post.id}`} className={styles.title}>
          {post.title}
        </Link>
      </h3>

      {post.skills.length > 0 && (
        <div className="stack-tight">
          <p className={`label ${styles.lookingFor}`}>Looking for</p>
          <div className="row-wrap">
            {post.skills.map((skill) => (
              <Tag key={skill}>{skill}</Tag>
            ))}
          </div>
        </div>
      )}

      <p className="meta">{filledLabel(post)}</p>

      {state === 'can_ask' && (
        <ButtonLink
          to={`/collab/${post.id}?ask=1`}
          fullWidth
          aria-label={`Ask to join ${post.title}`}
        >
          Ask to join
        </ButtonLink>
      )}
    </Card>
  );
}
