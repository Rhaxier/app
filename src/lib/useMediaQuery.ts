// True while a CSS media query matches, and re-renders when that changes:
//   const wide = useMediaQuery(WIDE_SCREEN);
// For layouts that differ in structure, not just style (the admin dashboard's
// side menu on a laptop vs a list screen on a phone). Plain styling belongs
// in CSS @media rules instead.
import { useSyncExternalStore } from 'react';

/** Laptop and up: room for a side menu next to the content. */
export const WIDE_SCREEN = '(min-width: 900px)';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => false,
  );
}
