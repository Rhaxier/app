// Pretend the test runs on a screen of a given size. The test browser
// (jsdom) has no window.matchMedia, so without this every screen renders its
// phone layout. Call setScreenSize() before rendering, and
// resetScreenSize() after the test (afterEach), so other tests stay on the
// phone layout.
//
// It understands the simple media queries the app uses: min-width,
// max-width, min-height and max-height in px, joined with "and". Anything
// else (dark mode, reduced motion…) doesn't match.

let current: { width: number; height: number } | null = null;

function matches(query: string, width: number, height: number): boolean {
  return query.split(/\s+and\s+/).every((part) => {
    const found = /\((min|max)-(width|height):\s*(\d+)px\)/.exec(part);
    if (!found) return false;
    const [, bound, side, value] = found;
    const size = side === 'width' ? width : height;
    return bound === 'min' ? size >= Number(value) : size <= Number(value);
  });
}

export function setScreenSize(width: number, height: number) {
  current = { width, height };
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: current ? matches(query, current.width, current.height) : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

export function resetScreenSize() {
  current = null;
  // Back to jsdom's default: no matchMedia at all.
  delete (window as { matchMedia?: unknown }).matchMedia;
}
