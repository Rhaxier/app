// Search (from the box on Home): rooms, volunteering events, announcements
// and collab posts, all from data the app already loads, so it works without
// a separate search service.
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/Card';
import { PageHeader, SectionHeader } from '@/components/PageHeader';
import { EmptyState, LoadingState } from '@/components/States';
import { useAnnouncements } from '@/features/announcements/hooks';
import { usePosts } from '@/features/collab/hooks';
import { SearchBox } from '@/features/home/components/SearchBox';
import { useRooms } from '@/features/map/hooks';
import { useEvents } from '@/features/volunteering/hooks';
import { formatDate } from '@/lib/dates';
import { searchAll } from '../logic';
import styles from './SearchPage.module.css';

export function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const rooms = useRooms();
  const events = useEvents();
  const announcements = useAnnouncements();
  const posts = usePosts();
  const loading = [rooms, events, announcements, posts].some((q) => q.isPending);

  const groups = searchAll(query, {
    rooms: (rooms.data ?? []).map((room) => ({
      item: {
        id: room.id,
        title: `${room.code} · ${room.name}`,
        detail: 'On the map',
        to: `/map?room=${encodeURIComponent(room.code)}`,
      },
      text: `${room.code} ${room.name}`,
    })),
    events: (events.data ?? []).map((event) => ({
      item: {
        id: event.id,
        title: event.title,
        detail: formatDate(event.starts_at),
        to: `/volunteer/${event.id}`,
      },
      text: `${event.title} ${event.organiser_label ?? ''} ${event.description}`,
    })),
    announcements: (announcements.data ?? []).map((a) => ({
      item: {
        id: a.id,
        title: a.title,
        detail: a.posted_as ?? a.author?.full_name ?? '',
        to: `/announcements/${a.id}`,
      },
      text: `${a.title} ${a.body} ${a.posted_as ?? ''}`,
    })),
    collab: (posts.data ?? []).map((post) => ({
      item: {
        id: post.id,
        title: post.title,
        detail: post.skills.join(', '),
        to: `/collab/${post.id}`,
      },
      text: `${post.title} ${post.description} ${post.skills.join(' ')}`,
    })),
  });

  return (
    <div className="stack">
      <PageHeader back={{ to: '/', label: 'Home' }} title="Search" />
      <SearchBox key={query} initialQuery={query} />
      {loading && <LoadingState />}
      {!loading && query && groups.length === 0 && (
        <EmptyState icon="search" title={`Nothing found for “${query}”`}>
          Try a room code like G.06, or part of a title.
        </EmptyState>
      )}
      {groups.map((group) => (
        <section key={group.kind} className="stack-tight" aria-labelledby={`search-${group.kind}`}>
          <SectionHeader id={`search-${group.kind}`} title={group.label} />
          <Card as="div" className={styles.list}>
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  <Link to={item.to} className={styles.result}>
                    <span className={styles.title}>{item.title}</span>
                    {item.detail && <span className="meta">{item.detail}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}
