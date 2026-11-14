// Search's data: the lists the app already loads (rooms, volunteering
// events, announcements, collab posts), shaped for searchAll() in ./logic.ts.
// They come from each feature's own cached queries, so searching needs no
// search service and no request per keystroke.
import { useContext } from 'react';
import { useAnnouncements } from '@/features/announcements/hooks';
import { usePosts } from '@/features/collab/hooks';
import { useRooms } from '@/features/map/hooks';
import { useEvents } from '@/features/volunteering/hooks';
import { formatDate } from '@/lib/dates';
import { SearchOverlayContext } from './context';
import type { SearchSources } from './logic';

export function useSearchSources(): { sources: SearchSources; loading: boolean } {
  const rooms = useRooms();
  const events = useEvents();
  const announcements = useAnnouncements();
  const posts = usePosts();
  const loading = [rooms, events, announcements, posts].some((q) => q.isPending);

  const sources: SearchSources = {
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
  };
  return { sources, loading };
}

/** Open or close the search overlay from anywhere (inside SearchOverlayProvider). */
export function useSearchOverlay() {
  const state = useContext(SearchOverlayContext);
  if (!state) throw new Error('useSearchOverlay must be used inside SearchOverlayProvider');
  return state;
}
