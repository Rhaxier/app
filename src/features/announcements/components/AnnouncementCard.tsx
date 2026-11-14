// =============================================================================
// Announcements: one card in the feed (layer 5 of 5: components and pages).
//
// Components only render what they're given; they never fetch. That makes
// them easy to reuse (Home and the full feed both use this card) and to test.
//
// `featured` is the big pinned card at the top of Home (design PDF page 6,
// "Pinned news first"): a larger title, "Read more" and, when there are
// several pinned posts, which one this is ("1 / 3").
// =============================================================================
import { Link } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { useSections } from '@/features/school/hooks';
import { formatDateTime, relativeTime } from '@/lib/dates';
import type { Announcement } from '../api';
import { audienceLabel, bylineOf } from '../format';
import { announcementState } from '../validation';
import styles from './AnnouncementCard.module.css';

interface AnnouncementCardProps {
  announcement: Announcement;
  /** Staff see who each post is for, because they see posts for every grade. */
  showAudience?: boolean;
  /** The big pinned card on Home. */
  featured?: boolean;
  /** Which of several pinned cards this is, e.g. "1 / 3". */
  position?: string;
}

export function AnnouncementCard({
  announcement,
  showAudience,
  featured,
  position,
}: AnnouncementCardProps) {
  const byline = bylineOf(announcement);
  const sections = useSections().data;
  const state = announcementState(announcement);
  return (
    <Card
      as="article"
      tone={announcement.urgent ? 'alert' : announcement.pinned ? 'accent' : 'default'}
      className={[styles.card, featured && styles.featured, 'pressable-card']
        .filter(Boolean)
        .join(' ')}
    >
      <Link to={`/announcements/${announcement.id}`} className={styles.link}>
        <div className={styles.top}>
          {announcement.urgent ? (
            <span className="label">Emergency · {byline}</span>
          ) : announcement.pinned ? (
            <span className="label">Pinned · {byline}</span>
          ) : (
            <span className="meta">{byline}</span>
          )}
          {/* Only the author and admins ever see scheduled or expired posts. */}
          {state === 'scheduled' ? (
            <Badge tone="attention">Scheduled · {formatDateTime(announcement.publish_at)}</Badge>
          ) : state === 'expired' ? (
            <Badge tone="quiet">Expired</Badge>
          ) : (
            <span className="meta">{relativeTime(announcement.publish_at)}</span>
          )}
        </div>
        <h3 className={styles.title}>{announcement.title}</h3>
        {announcement.body && <p className={styles.body}>{announcement.body}</p>}
        {showAudience && <p className="meta">For: {audienceLabel(announcement, sections)}</p>}
        {featured && (
          <span className={styles.more}>
            <span className={styles.readMore}>
              Read more <Icon name="arrowRight" size={15} />
            </span>
            {position && <span className="meta">{position}</span>}
          </span>
        )}
      </Link>
    </Card>
  );
}
