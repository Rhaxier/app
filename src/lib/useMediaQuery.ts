// True while a CSS media query matches, and re-renders when that changes:
//   const tall = useMediaQuery('(min-height: 700px)');
// For layouts that differ in structure, not just style. The screen sizes
// (phone, tablet, laptop) are in src/lib/layout.ts: use useLayoutMode() for
// those. Plain styling belongs in CSS @media or @container rules instead.
import { useSyncExternalStore } from 'react';

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
