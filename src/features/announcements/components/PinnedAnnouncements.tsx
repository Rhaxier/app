// The top of Home (design PDF page 6, "Pinned news first"): pinned and
// emergency announcements as the one large card on the page. With several,
// they sit side by side and you swipe between them; each card shows which one
// it is ("1 / 3"). Scroll snapping does the swiping, so there's no script.
import { LoadingState } from '@/components/States';
import { useAnnouncements } from '../hooks';
import { HOME_ANNOUNCEMENT_COUNT, splitForHome } from '../format';
import { AnnouncementCard } from './AnnouncementCard';
import styles from './PinnedAnnouncements.module.css';

export function PinnedAnnouncements() {
  // The same query as the list further down Home, so it's one request.
  const announcements = useAnnouncements(HOME_ANNOUNCEMENT_COUNT);
  if (announcements.isPending) return <LoadingState count={1} />;
  const { featured } = splitForHome(announcements.data ?? []);
  if (featured.length === 0) return null;

  return (
    <section aria-label="Pinned announcements">
      <ul className={styles.track}>
        {featured.map((announcement, index) => (
          <li key={announcement.id} className={styles.slide}>
            <AnnouncementCard
              announcement={announcement}
              featured
              position={featured.length > 1 ? `${index + 1} / ${featured.length}` : undefined}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
