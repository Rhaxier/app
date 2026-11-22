// useElementWidth: the width an element really has, for layouts that change
// structure with the room available (the booking panel beside the calendar).
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useElementWidth } from './useElementWidth';

function Measured() {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  return <div ref={ref}>{width >= 700 ? 'side by side' : 'one column'}</div>;
}

// The test browser has no ResizeObserver: this one lets a test say how wide
// the element has become.
let report: ((width: number) => void) | null = null;
class FakeResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    report = (width) =>
      callback([{ contentRect: { width } } as ResizeObserverEntry], this as never);
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe('useElementWidth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    report = null;
  });

  it('is 0 without ResizeObserver, so the phone layout shows', () => {
    render(<Measured />);
    expect(screen.getByText('one column')).toBeInTheDocument();
  });

  it('follows the element as it widens and narrows (a window resized, an iPad turned)', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    render(<Measured />);
    act(() => report?.(820));
    expect(screen.getByText('side by side')).toBeInTheDocument();
    act(() => report?.(560));
    expect(screen.getByText('one column')).toBeInTheDocument();
  });
});
