// Home (reference screen 1; design PDF page 6): the greeting, pinned news as
// the one large card, the six tools, then the sections other features add
// (bell times, today's bookings, the latest announcements). Search is the
// round button beside the tab bar. Sections of a switched-off feature are
// left out (Admin > System > Feature switches).
import { HomeAnnouncements } from '@/features/announcements/components/HomeAnnouncements';
import { PinnedAnnouncements } from '@/features/announcements/components/PinnedAnnouncements';
import { useCurrentUser } from '@/features/auth/hooks';
import { TodayBellTimes } from '@/features/school/components/TodayBellTimes';
import { useFeatureVisible } from '@/features/settings/hooks';
import { TodayAtSchool } from '@/features/venues/components/TodayAtSchool';
import { isAdmin } from '@/lib/permissions';
import { HomeHeader } from '../components/HomeHeader';
import { QuickTiles } from '../components/QuickTiles';

export function HomePage() {
  const visible = useFeatureVisible(isAdmin(useCurrentUser()));
  return (
    <div className="stack">
      <HomeHeader />
      <div className="stack-tight">
        {visible('announcements') && <PinnedAnnouncements />}
        <QuickTiles />
      </div>
      <TodayBellTimes />
      {visible('venues') && <TodayAtSchool />}
      {visible('announcements') && <HomeAnnouncements />}
    </div>
  );
}
