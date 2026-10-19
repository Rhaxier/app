// The full announcements feed, reached from "See all" on Home.
import { Fab } from '@/components/Fab';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { isStaff } from '@/lib/permissions';
import { AnnouncementCard } from '../components/AnnouncementCard';
import { useAnnouncements } from '../hooks';

export function AnnouncementsPage() {
  const user = useCurrentUser();
  const announcements = useAnnouncements();

  return (
    <div className="stack">
      <PageHeader
        back={{ to: '/', label: 'Home' }}
        title="Announcements"
        subtitle="News for you and the whole school"
        action={isStaff(user) && <Fab to="/announcements/new" label="New announcement" />}
      />
      {announcements.isPending && <LoadingState />}
      {announcements.isError && (
        <ErrorState error={announcements.error} onRetry={() => announcements.refetch()} />
      )}
      {announcements.data?.length === 0 && (
        <EmptyState icon="megaphone" title="No announcements yet">
          School news will appear here.
        </EmptyState>
      )}
      <div className="stack-tight">
        {announcements.data?.map((announcement) => (
          <AnnouncementCard
            key={announcement.id}
            announcement={announcement}
            showAudience={isStaff(user)}
          />
        ))}
      </div>
    </div>
  );
}
