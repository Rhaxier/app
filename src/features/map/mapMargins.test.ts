// Where the full-screen map fits its plan on each kind of screen
// (mapMargins.ts): phones keep their margins, an upright iPad moves them
// beside the rail, and a wide screen held sideways fits the plan to the right
// of the controls' column.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resetScreenSize, setScreenSize } from '@/test/media';
import { MAP_PANEL_WIDTH, marginsFor, useMapArrangement } from './mapMargins';

const phone = { top: 132, bottom: 150 };

describe('map margins', () => {
  afterEach(() => resetScreenSize());

  it('keeps the phone margins on a phone', () => {
    expect(marginsFor('phone', phone)).toEqual(phone);
  });

  it('moves them beside the rail on an upright iPad, with no tab bar below', () => {
    const margins = marginsFor('tablet', phone);
    expect(margins.top).toBe(132);
    expect(margins.bottom).toBe(150 - 80);
    expect(margins.left).toBe(16 + 72 + 16);
  });

  it('fits the plan right of the controls column when the screen is sideways', () => {
    const margins = marginsFor('side', phone);
    expect(margins.left).toBeGreaterThan(16 + 72 + MAP_PANEL_WIDTH);
    expect(margins.top).toBe(24);
  });

  it.each([
    ['an iPhone', 390, 844, 'phone'],
    ['an iPad held upright', 820, 1180, 'tablet'],
    ['an iPad Pro 13" held upright', 1024, 1366, 'tablet'],
    ['an iPad turned sideways', 1180, 820, 'side'],
    ['a laptop', 1280, 800, 'side'],
  ])('arranges the controls for %s', (_name, width, height, arrangement) => {
    setScreenSize(width as number, height as number);
    expect(renderHook(() => useMapArrangement()).result.current).toBe(arrangement);
  });
});
