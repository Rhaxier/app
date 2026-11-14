// Screen changes: which way is the person going? AppLayout animates each
// change with Motion (iOS-style):
//   fade     switching tabs, or between unrelated screens: a cross-fade
//   forward  drilling in, e.g. /collab → /collab/123: the new screen slides in
//            from the right while the old one drifts left and fades
//   back     coming back out, e.g. /collab/123 → /collab: the same, reversed
// Only the screen moves. The tab bar sits outside it and stays put, and
// screens move their fixed chrome (the map, the booking bar) out of the
// sliding layer with PageChrome, so it fades in place instead.
import { useState } from 'react';
import type { Variants } from 'motion/react';
import { distance, spring } from '@/lib/motion';
import { tabOf } from './tabs';

export type ScreenTransition = 'fade' | 'forward' | 'back';

function depth(pathname: string): number {
  return pathname.split('/').filter(Boolean).length;
}

/** Which way is the person going? Deeper within one tab = forward. */
export function transitionKind(from: string, to: string): ScreenTransition {
  if (tabOf(from) !== tabOf(to)) return 'fade';
  if (depth(to) > depth(from)) return 'forward';
  if (depth(to) < depth(from)) return 'back';
  return 'fade';
}

/** The kind of the latest screen change (works for the browser's back button too). */
export function useScreenTransition(pathname: string): ScreenTransition {
  // React's "adjust state while rendering" pattern: when the address changes,
  // work out the direction straight away, before the new screen is drawn.
  const [state, setState] = useState({ pathname, kind: 'fade' as ScreenTransition });
  if (state.pathname !== pathname) {
    setState({ pathname, kind: transitionKind(state.pathname, pathname) });
  }
  return state.pathname === pathname ? state.kind : transitionKind(state.pathname, pathname);
}

/**
 * How a screen enters and leaves, given the kind (Motion's `custom` value).
 * The leaving screen moves half as far, like the parallax on iOS.
 */
export const screenVariants: Variants = {
  enter: (kind: ScreenTransition) => ({
    opacity: 0,
    x: kind === 'forward' ? distance.page : kind === 'back' ? -distance.page : 0,
  }),
  shown: { opacity: 1, x: 0, transition: spring.page },
  leave: (kind: ScreenTransition) => ({
    opacity: 0,
    // The leaving screen can't be tapped while it fades.
    pointerEvents: 'none',
    x: kind === 'forward' ? -distance.page / 2 : kind === 'back' ? distance.page : 0,
    transition: { ...spring.page, duration: 0.22 },
  }),
};
