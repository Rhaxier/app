// The staff queue: plain functions for the Approvals screen (tested in
// approvals.test.ts). Everything waiting on this person becomes one list,
// oldest first, whatever feature it came from (design PDF page 9, "Staff get
// one queue").
import { differenceInMinutes } from 'date-fns';
import type { BadgeTone } from '@/components/Badge';

export type QueueType = 'event' | 'venue' | 'fixit' | 'hours' | 'content';

/** The type chip on each row, coloured as on the desk view mockup. */
export const queueTypes: Record<QueueType, { label: string; plural: string; tone: BadgeTone }> = {
  venue: { label: 'Venue', plural: 'Venues', tone: 'accent' },
  event: { label: 'Event', plural: 'Events', tone: 'good' },
  fixit: { label: 'Fix-it', plural: 'Fix-it', tone: 'fix' },
  hours: { label: 'Hours', plural: 'Hours', tone: 'attention' },
  content: { label: 'Reported', plural: 'Reported', tone: 'quiet' },
};

export interface QueueEntry {
  key: string;
  type: QueueType;
  /** When it started waiting (ISO time). */
  since: string;
}

/** How long something has waited, in a few letters: "12m", "6h", "2d". */
export function shortWait(since: string, now: Date = new Date()): string {
  const minutes = Math.max(0, differenceInMinutes(now, new Date(since)));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / (24 * 60))}d`;
}

/** Oldest first, so the longest wait is at the top. */
export function sortQueue<T extends QueueEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.since.localeCompare(b.since));
}

/** The filter above the queue: All, then only the types that have something waiting. */
export function queueFilters(
  entries: QueueEntry[],
): { value: 'all' | QueueType; label: string; count: number }[] {
  const order: QueueType[] = ['event', 'venue', 'fixit', 'hours', 'content'];
  const present = order
    .map((type) => ({
      value: type,
      label: queueTypes[type].plural,
      count: entries.filter((entry) => entry.type === type).length,
    }))
    .filter((option) => option.count > 0);
  return [{ value: 'all', label: 'All', count: entries.length }, ...present];
}
