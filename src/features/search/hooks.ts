// Search's hooks:
//   useSearchSources   the lists the app already loads (rooms, volunteering
//                      events, announcements, collab posts), shaped for
//                      searchAll() in ./logic.ts. They come from each feature's
//                      own cached queries, so searching needs no search service
//                      and no request per keystroke.
//   useSearchAsYouType when the results catch up with what's being typed
//   useSearchOverlay   open or close the search overlay
import { useContext, useEffect, useRef, useState } from 'react';
import { useAnnouncements } from '@/features/announcements/hooks';
import { usePosts } from '@/features/collab/hooks';
import { useRooms } from '@/features/map/hooks';
import { roomLabel } from '@/features/map/logic';
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
        title: roomLabel(room),
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

/** How long typing has to pause before the results update. Enter searches at once. */
export const SEARCH_DELAY_MS = 150;

/**
 * Search as you type. `draft` is what's in the field; `query` is what the
 * results show. The query catches up:
 *   * 150ms after the last keystroke, so a fast typist doesn't redraw the
 *     list on every letter
 *   * straight away on Enter (`submit`)
 *   * never halfway through a word that a Japanese, Chinese or Korean keyboard
 *     is still composing: those half-made characters aren't what the person
 *     means yet. The field reports composing with `compositionStart` and
 *     `compositionEnd`.
 *
 * Out-of-order answers can't happen: there's no request per keystroke (see
 * useSearchSources), and the panel works its results out from `query` each
 * time it draws, so nothing from an older query can arrive late and replace
 * a newer one.
 */
export function useSearchAsYouType(initialQuery: string, onSearch?: (query: string) => void) {
  const [draft, setDraft] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  // Refs, not state: changing them shouldn't redraw anything.
  const timer = useRef<number | undefined>(undefined);
  const composing = useRef(false);

  // If the panel closes during a pause, don't search after it's gone.
  useEffect(() => {
    const pending = timer;
    return () => window.clearTimeout(pending.current);
  }, []);

  function searchNow(text: string) {
    window.clearTimeout(timer.current);
    const trimmed = text.trim();
    setQuery(trimmed);
    onSearch?.(trimmed);
  }

  function searchSoon(text: string) {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => searchNow(text), SEARCH_DELAY_MS);
  }

  return {
    draft,
    query,
    /** The field changed: a keystroke, a paste, or the clear button. */
    type(text: string) {
      setDraft(text);
      if (!composing.current) searchSoon(text);
    },
    /** Enter, or the keyboard's Search key. */
    submit() {
      searchNow(draft);
    },
    compositionStart() {
      composing.current = true;
      window.clearTimeout(timer.current);
    },
    compositionEnd(text: string) {
      composing.current = false;
      searchSoon(text);
    },
  };
}

/** Open or close the search overlay from anywhere (inside SearchOverlayProvider). */
export function useSearchOverlay() {
  const state = useContext(SearchOverlayContext);
  if (!state) throw new Error('useSearchOverlay must be used inside SearchOverlayProvider');
  return state;
}
