// The Announcements section on Home: the three most important posts (pinned
// first), with "See all" leading to the full feed.
import { Link } from 'react-router-dom';
import { SectionHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAnnouncements } from '../hooks';
import { AnnouncementCard } from './AnnouncementCard';

export function HomeAnnouncements() {
  // Every loading/error/empty case comes from the same query object.
  const announcements = useAnnouncements(3);

  return (
    <section className="stack-tight" aria-labelledby="home-announcements">
      <SectionHeader
        id="home-announcements"
        title="Announcements"
        action={<Link to="/announcements">See all</Link>}
      />
      {announcements.isPending && <LoadingState />}
      {announcements.isError && (
        <ErrorState error={announcements.error} onRetry={() => announcements.refetch()} />
      )}
      {announcements.data?.length === 0 && (
        <EmptyState icon="megaphone" title="No announcements yet" />
      )}
      {announcements.data?.map((announcement) => (
        <AnnouncementCard key={announcement.id} announcement={announcement} />
      ))}
    </section>
  );
}
