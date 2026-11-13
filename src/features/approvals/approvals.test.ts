// The staff queue: waiting times, order, and the filter above it.
import { describe, expect, it } from 'vitest';
import { queueFilters, shortWait, sortQueue, type QueueEntry } from './logic';

const now = new Date('2026-10-19T08:00:00Z');

describe('shortWait', () => {
  it('says how long something has waited in a few letters', () => {
    expect(shortWait('2026-10-19T07:48:00Z', now)).toBe('12m');
    expect(shortWait('2026-10-19T02:00:00Z', now)).toBe('6h');
    expect(shortWait('2026-10-17T07:00:00Z', now)).toBe('2d');
    // A time a little in the future (clocks differ) still reads sensibly.
    expect(shortWait('2026-10-19T08:01:00Z', now)).toBe('0m');
  });
});

describe('the queue', () => {
  const entries: QueueEntry[] = [
    { key: 'a', type: 'venue', since: '2026-10-18T08:00:00Z' },
    { key: 'b', type: 'event', since: '2026-10-17T08:00:00Z' },
    { key: 'c', type: 'venue', since: '2026-10-19T07:00:00Z' },
  ];

  it('puts the longest wait first, whatever kind of item it is', () => {
    expect(sortQueue(entries).map((entry) => entry.key)).toEqual(['b', 'a', 'c']);
  });

  it('offers All, then only the kinds that have something waiting, with counts', () => {
    expect(queueFilters(entries)).toEqual([
      { value: 'all', label: 'All', count: 3 },
      { value: 'event', label: 'Events', count: 1 },
      { value: 'venue', label: 'Venues', count: 2 },
    ]);
  });
});
