// The width of an element in px, kept up to date as it changes (a window
// resized or an iPad turned):
//   const [ref, width] = useElementWidth<HTMLDivElement>();
//   <div ref={ref}>…</div>
//
// For layouts that differ in structure, not just style, by the room a screen
// really has (the map beside the room list, the booking panel beside the
// calendar). The room depends on the side navigation and the screen's own
// width, not only the window, which a media query can't know. Plain styling
// belongs in CSS container queries instead (@container screen …).
//
// The first width is read before the screen is first drawn, so the layout
// never flashes from one arrangement to the other. Where the browser can't
// measure (the test browser) the width is 0, so the phone layout shows.
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

export function useElementWidth<T extends HTMLElement>(): [(element: T | null) => void, number] {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(0);

  // Before the first paint: the width it has now.
  useLayoutEffect(() => {
    if (element) setWidth(Math.round(element.getBoundingClientRect().width));
  }, [element]);

  // Then every change.
  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      // Rounded, so sub-pixel changes don't re-render.
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  const ref = useCallback((next: T | null) => setElement(next), []);
  return [ref, width];
}
