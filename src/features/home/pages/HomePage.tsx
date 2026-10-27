// Home (reference screen 1): greeting, search, the six tools, and the
// sections other features add (bell times, today's bookings, announcements). Sections of
// a switched-off feature are left out (Admin > System > Feature switches).
import { HomeAnnouncements } from '@/features/announcements/components/HomeAnnouncements';
import { useCurrentUser } from '@/features/auth/hooks';
import { TodayBellTimes } from '@/features/school/components/TodayBellTimes';
import { useFeatureVisible } from '@/features/settings/hooks';
import { TodayAtSchool } from '@/features/venues/components/TodayAtSchool';
import { isAdmin } from '@/lib/permissions';
import { HomeHeader } from '../components/HomeHeader';
import { QuickTiles } from '../components/QuickTiles';
import { SearchBox } from '../components/SearchBox';

export function HomePage() {
  const visible = useFeatureVisible(isAdmin(useCurrentUser()));
  return (
    <div className="stack">
      <HomeHeader />
      <SearchBox />
      <QuickTiles />
      <TodayBellTimes />
      {visible('venues') && <TodayAtSchool />}
      {visible('announcements') && <HomeAnnouncements />}
    </div>
  );
}
