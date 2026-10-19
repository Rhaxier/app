// Home (reference screen 1): greeting, search, the six tools, and the
// sections other features add (today's bookings, announcements).
import { HomeAnnouncements } from '@/features/announcements/components/HomeAnnouncements';
import { HomeHeader } from '../components/HomeHeader';
import { QuickTiles } from '../components/QuickTiles';
import { SearchBox } from '../components/SearchBox';

export function HomePage() {
  return (
    <div className="stack">
      <HomeHeader />
      <SearchBox />
      <QuickTiles />
      <HomeAnnouncements />
    </div>
  );
}
