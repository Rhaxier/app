// "Has the screen finished arriving?" For screens with a heavy part (the
// floor plan: hundreds of shapes for Leaflet to draw), which would otherwise
// be built in the same moment the screen change animates (the screen sliding
// or fading in, the sidebar narrowing into a rail) and make it stutter,
// badly so on a tablet.
//
// False for the length of a screen change after an in-app navigation, then
// true; the heavy part is drawn then and fades in. On the first screen of a
// visit (React Router's key "default") or with reduced motion there's no
// animation to protect, so it's true at once.
import { useContext, useEffect, useState } from 'react';
import { UNSAFE_LocationContext } from 'react-router-dom';
import { duration, prefersReducedMotion } from './motion';

/** A screen change (spring.page) or the sidebar reshaping (--motion-slow), whichever is longer, plus a frame. */
export const SETTLE_MS = Math.max(320, duration.slow) + 40;

export function useSettled(): boolean {
  // Read without useLocation, which throws outside a router (some tests
  // render map parts on their own): no router, no screen change to wait for.
  const key = useContext(UNSAFE_LocationContext)?.location?.key ?? 'default';
  const [settled, setSettled] = useState(() => key === 'default' || prefersReducedMotion());
  useEffect(() => {
    if (settled) return;
    const timer = window.setTimeout(() => setSettled(true), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [settled]);
  return settled;
}
