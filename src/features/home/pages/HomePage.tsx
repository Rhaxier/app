// Home (reference screen 1; design PDF page 6): the greeting, pinned news as
// the one large card, the six tools, then the sections other features add
// (bell times, today's bookings, the latest announcements). Search is the
// round button beside the tab bar. Sections of a switched-off feature are
// left out (Admin > System > Feature switches).
//
// On a wide laptop or an iPad turned sideways, Home is a dashboard: news, the
// tools and announcements on the left; bell times and today at school in a
// column on the right (HomePage.module.css). On a phone the order is as above.
import { HomeAnnouncements } from '@/features/announcements/components/HomeAnnouncements';
import { PinnedAnnouncements } from '@/features/announcements/components/PinnedAnnouncements';
import { useCurrentUser } from '@/features/auth/hooks';
import { TodayBellTimes } from '@/features/school/components/TodayBellTimes';
import { useFeatureVisible } from '@/features/settings/hooks';
import { TodayAtSchool } from '@/features/venues/components/TodayAtSchool';
import { isAdmin } from '@/lib/permissions';
import { HomeHeader } from '../components/HomeHeader';
import { QuickTiles } from '../components/QuickTiles';
import styles from './HomePage.module.css';

export function HomePage() {
  const visible = useFeatureVisible(isAdmin(useCurrentUser()));
  return (
    <div className={`stack ${styles.home}`}>
      <div className={styles.header}>
        <HomeHeader />
      </div>
      <div className={`stack-tight ${styles.lead}`}>
        {visible('announcements') && <PinnedAnnouncements />}
        <QuickTiles />
      </div>
      <div className={styles.side}>
        <TodayBellTimes />
        {visible('venues') && <TodayAtSchool />}
      </div>
      {visible('announcements') && (
        <div className={styles.news}>
          <HomeAnnouncements />
        </div>
      )}
    </div>
  );
}
