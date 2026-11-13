// The date helpers must show Dubai time whatever the computer's own time zone is.
import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  atSchoolTime,
  dateBlock,
  dayKey,
  dayRange,
  formatDayHeading,
  formatTimeRange,
  fromDateTimeInputValue,
  greeting,
  relativeTime,
  shortWhen,
  toDateTimeInputValue,
} from './dates';

describe('dates (Asia/Dubai)', () => {
  it('formats in Dubai time, not UTC', () => {
    // 03:30 UTC is 07:30 in Dubai (UTC+4, no daylight saving).
    expect(formatTimeRange('2026-10-18T03:30:00Z', '2026-10-18T06:00:00Z')).toBe('7:30–10:00');
    expect(formatDayHeading('2026-10-11T05:00:00Z')).toBe('Sunday, 11 October');
  });

  it('uses the Dubai calendar day near midnight', () => {
    // 21:00 UTC on the 18th is already 01:00 on the 19th in Dubai.
    expect(dayKey('2026-10-18T21:00:00Z')).toBe('2026-10-19');
    expect(dateBlock('2026-10-18T21:00:00Z')).toEqual({ month: 'OCT', day: '19', weekday: 'Mon' });
  });

  it('builds instants from Dubai wall-clock times', () => {
    expect(atSchoolTime('2026-10-19', '07:30').toISOString()).toBe('2026-10-19T03:30:00.000Z');
    expect(dayRange('2026-10-19')).toEqual({
      start: '2026-10-18T20:00:00.000Z',
      end: '2026-10-19T20:00:00.000Z',
    });
    expect(addDaysToKey('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('round-trips datetime-local input values', () => {
    expect(toDateTimeInputValue('2026-10-19T03:30:00Z')).toBe('2026-10-19T07:30');
    expect(fromDateTimeInputValue('2026-10-19T07:30')).toBe('2026-10-19T03:30:00.000Z');
    expect(fromDateTimeInputValue('')).toBeNull();
  });

  it('describes how long ago something happened', () => {
    const now = new Date('2026-10-19T08:00:00Z'); // Monday 12:00 in Dubai
    expect(relativeTime('2026-10-19T06:00:00Z', now)).toBe('2h ago');
    expect(relativeTime('2026-10-18T08:00:00Z', now)).toBe('Yesterday');
    expect(relativeTime('2026-10-15T08:00:00Z', now)).toBe('Thu');
    expect(relativeTime('2026-10-01T08:00:00Z', now)).toBe('1 Oct');
  });

  it('says when in a few letters, for narrow columns', () => {
    const now = new Date('2026-10-19T08:00:00Z'); // Monday 12:00 in Dubai
    expect(shortWhen('2026-10-19T04:12:00Z', now)).toBe('8:12');
    expect(shortWhen('2026-10-18T08:00:00Z', now)).toBe('Yest.');
    expect(shortWhen('2026-10-15T08:00:00Z', now)).toBe('Thu');
    expect(shortWhen('2026-10-01T08:00:00Z', now)).toBe('1 Oct');
  });

  it('greets by Dubai time of day', () => {
    expect(greeting(new Date('2026-10-19T04:00:00Z'))).toBe('Good morning'); // 08:00
    expect(greeting(new Date('2026-10-19T10:00:00Z'))).toBe('Good afternoon'); // 14:00
    expect(greeting(new Date('2026-10-19T15:00:00Z'))).toBe('Good evening'); // 19:00
  });
});
