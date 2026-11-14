// The Announcements list on Home (design PDF page 6): the newest posts that
// aren't pinned (pinned ones are the big card at the top), as quiet rows with
// a short date on the left, and "All" leading to the full feed.
import { Link } from 'react-router-dom';
import { SectionHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState } from '@/components/States';
import { shortWhen } from '@/lib/dates';
import { useAnnouncements } from '../hooks';
import { bylineOf, HOME_ANNOUNCEMENT_COUNT, splitForHome } from '../format';
import styles from './HomeAnnouncements.module.css';

export function HomeAnnouncements() {
  // Every loading/error/empty case comes from the same query object. Pinned
  // posts use the same query (PinnedAnnouncements), so it's one request.
  const announcements = useAnnouncements(HOME_ANNOUNCEMENT_COUNT);
  if (announcements.isPending) return null;
  const { featured, rest } = splitForHome(announcements.data ?? []);
  // With only pinned posts, the big card already shows them all.
  if (announcements.data && rest.length === 0 && featured.length > 0) return null;

  return (
    <section className="stack-tight" aria-labelledby="home-announcements">
      <SectionHeader
        id="home-announcements"
        title="Announcements"
        action={<Link to="/announcements">All</Link>}
      />
      {announcements.isError && (
        <ErrorState error={announcements.error} onRetry={() => announcements.refetch()} />
      )}
      {announcements.data?.length === 0 && (
        <EmptyState icon="megaphone" title="No announcements yet" />
      )}
      {rest.length > 0 && (
        <ul className={`${styles.list} stagger`}>
          {rest.map((announcement) => (
            <li key={announcement.id}>
              <Link to={`/announcements/${announcement.id}`} className={`${styles.row} pressable`}>
                <span className={styles.when}>{shortWhen(announcement.publish_at)}</span>
                <span className={styles.text}>
                  <span className={styles.title}>{announcement.title}</span>
                  <span className="meta">{bylineOf(announcement)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
