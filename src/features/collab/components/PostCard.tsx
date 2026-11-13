// One post in the Collab finder (reference screen 6; design PDF page 8,
// "Teams that form"): who posted it and their grade, what they're building,
// the skills they're looking for, then spots you can count (filled dots for
// teammates, open dots for gaps) and "Ask to join".
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { Badge, type BadgeTone } from '@/components/Badge';
import { ButtonLink } from '@/components/Button';
import { Tag } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { relativeTime } from '@/lib/dates';
import type { CollabPost } from '../api';
import { openLabel, type JoinState } from '../logic';
import styles from './PostCard.module.css';

const stateBadge: Partial<Record<JoinState, { label: string; tone: BadgeTone }>> = {
  own: { label: 'Your post', tone: 'quiet' },
  on_team: { label: 'On the team', tone: 'accent' },
  full: { label: 'Full', tone: 'quiet' },
  closed: { label: 'Closed', tone: 'quiet' },
};

/** "2d" from "2 days ago" style times, for the top-right corner. */
function shortAgo(value: string): string {
  return relativeTime(value).replace(' ago', '');
}

export function PostCard({ post, state }: { post: CollabPost; state: JoinState }) {
  const owner = post.owner?.full_name ?? 'Student';
  const badge = post.hidden_by
    ? { label: 'Hidden for review', tone: 'attention' as const }
    : stateBadge[state];
  const filled = Math.min(post.accepted_count, post.spots_wanted);

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <Avatar name={owner} initials={post.owner?.avatar_initials} size="small" tone="quiet" />
        <p className={styles.name}>{owner}</p>
        <p className="meta">
          {post.owner?.grade ? `Gr ${post.owner.grade} · ` : ''}
          {shortAgo(post.created_at)}
        </p>
      </div>

      <h3 className={styles.title}>
        <Link to={`/collab/${post.id}`} className={styles.titleLink}>
          {post.title}
        </Link>
      </h3>

      {post.skills.length > 0 && (
        <div className={styles.looking}>
          <p className={`label ${styles.lookingFor}`}>Looking for</p>
          <div className="row-wrap">
            {post.skills.map((skill) => (
              <Tag key={skill}>{skill}</Tag>
            ))}
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <p className={styles.spots}>
          <span className={styles.dots} aria-hidden="true">
            {Array.from({ length: post.spots_wanted }, (_, i) => (
              <span key={i} className={i < filled ? styles.dotFilled : styles.dot} />
            ))}
          </span>
          {openLabel(post)}
        </p>
        {state === 'can_ask' && !post.hidden_by ? (
          <ButtonLink
            to={`/collab/${post.id}?ask=1`}
            variant="accent"
            size="small"
            className={styles.ask}
            aria-label={`Ask to join ${post.title}`}
          >
            Ask to join
          </ButtonLink>
        ) : state === 'requested' ? (
          <span className={styles.requested}>
            Requested <Icon name="check" size={14} />
          </span>
        ) : (
          badge && <Badge tone={badge.tone}>{badge.label}</Badge>
        )}
      </div>
    </article>
  );
}
