// How wide each screen may grow on a tablet or laptop (screenWidths.ts), and
// which layout each screen size gets (src/lib/layout.ts).
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useLayoutMode } from '@/lib/layout';
import { resetScreenSize, setScreenSize } from '@/test/media';
import { screenWidth } from './screenWidths';

describe('screenWidth', () => {
  it('gives forms and text a reading width', () => {
    for (const path of [
      '/volunteer/new',
      '/projects/abc/edit',
      '/collab/new',
      '/announcements/new',
      '/announcements/abc',
      '/book/request',
      '/me',
      '/notifications',
      '/search',
    ]) {
      expect(screenWidth(path), path).toBe('reading');
    }
  });

  it('gives lists, detail screens and the map the page width', () => {
    for (const path of [
      '/',
      '/announcements',
      '/volunteer',
      '/volunteer/abc',
      '/collab/abc',
      '/book',
      '/map',
      '/map/report',
      '/reports/abc',
    ]) {
      expect(screenWidth(path), path).toBe('page');
    }
  });

  it('gives the desk view and the admin dashboard the wide width', () => {
    expect(screenWidth('/approvals')).toBe('wide');
    expect(screenWidth('/admin')).toBe('wide');
    expect(screenWidth('/admin/map-rooms')).toBe('wide');
  });
});

describe('useLayoutMode', () => {
  afterEach(() => resetScreenSize());

  const cases: [string, number, number, string][] = [
    ['iPhone', 390, 844, 'phone'],
    ['iPhone turned sideways', 932, 430, 'phone'],
    ['iPad mini upright', 744, 1133, 'tablet'],
    ['iPad upright', 820, 1180, 'tablet'],
    ['iPad turned sideways', 1180, 820, 'laptop'],
    ['laptop', 1280, 800, 'laptop'],
    ['large monitor', 1536, 864, 'laptop'],
  ];

  it.each(cases)('%s (%i × %i) → %s', (_name, width, height, mode) => {
    setScreenSize(width, height);
    const { result } = renderHook(() => useLayoutMode());
    expect(result.current).toBe(mode);
  });
});
