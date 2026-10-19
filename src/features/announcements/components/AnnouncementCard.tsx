// =============================================================================
// Announcements: one card in the feed (layer 5 of 5: components and pages).
//
// Components only render what they're given; they never fetch. That makes
// them easy to reuse (Home and the full feed both use this card) and to test.
// =============================================================================
import { Link } from 'react-router-dom';
import { Card } from '@/components/Card';
import { relativeTime } from '@/lib/dates';
import type { Announcement } from '../api';
import { audienceLabel, bylineOf } from '../format';
import styles from './AnnouncementCard.module.css';

interface AnnouncementCardProps {
  announcement: Announcement;
  /** Staff see who each post is for, because they see posts for every grade. */
  showAudience?: boolean;
}

export function AnnouncementCard({ announcement, showAudience }: AnnouncementCardProps) {
  const byline = bylineOf(announcement);
  return (
    <Card as="article" tone={announcement.pinned ? 'accent' : 'default'} className={styles.card}>
      <Link to={`/announcements/${announcement.id}`} className={styles.link}>
        <div className={styles.top}>
          {announcement.pinned ? (
            <span className="label">Pinned · {byline}</span>
          ) : (
            <span className="meta">{byline}</span>
          )}
          <span className="meta">{relativeTime(announcement.published_at)}</span>
        </div>
        <h3 className={styles.title}>{announcement.title}</h3>
        {announcement.body && <p className={styles.body}>{announcement.body}</p>}
        {showAudience && <p className="meta">For: {audienceLabel(announcement)}</p>}
      </Link>
    </Card>
  );
}
