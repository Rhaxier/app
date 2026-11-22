// Where the admin menu goes on each screen (useMenuBeside.ts): beside the
// sections on a laptop, its own screen on a tablet or phone, and beside them
// on a large phone turned sideways, as it always was.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resetScreenSize, setScreenSize } from '@/test/media';
import { useMenuBeside } from './useMenuBeside';

describe('useMenuBeside', () => {
  afterEach(() => resetScreenSize());

  it.each([
    ['an iPhone', 390, 844, false],
    ['an iPhone Pro Max turned sideways (unchanged: 900px+)', 932, 430, true],
    ['an iPad held upright', 820, 1180, false],
    ['an iPad turned sideways', 1180, 820, true],
    ['a laptop', 1280, 800, true],
  ])('%s → menu beside: %s', (_name, width, height, beside) => {
    setScreenSize(width as number, height as number);
    expect(renderHook(() => useMenuBeside()).result.current).toBe(beside);
  });
});
