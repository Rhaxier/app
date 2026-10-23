// Screen changes, animated with the browser's View Transitions API.
//
// The animations themselves are CSS (the "Screen changes" part of
// src/styles/motion.css). This file does two small jobs for them:
//   1. Ask React Router to use a view transition for every navigation.
//   2. Before each new screen is drawn, write the direction on <html data-nav>:
//        fade     switching tabs, or between unrelated screens
//        forward  drilling in, e.g. /collab → /collab/123
//        back     coming back out, e.g. /collab/123 → /collab
// Browsers without the API simply change screens with no animation; AppLayout
// adds a plain fade for them. Nothing here ever waits or blocks a tap.
import type { createBrowserRouter, RouterNavigateOptions, To } from 'react-router-dom';
import { tabOf } from './tabs';

type AppRouter = ReturnType<typeof createBrowserRouter>;

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

export function enableScreenTransitions(router: AppRouter): void {
  // 1. React Router animates a navigation only when asked to
  //    (<Link viewTransition>). Rather than remembering that on every link in
  //    the app, we wrap the router's navigate() once so it always asks.
  //    (navigate(-1) means "go back" and takes no options.)
  const navigate = router.navigate.bind(router);
  router.navigate = ((to: To | number | null, options?: RouterNavigateOptions) =>
    typeof to === 'number'
      ? navigate(to)
      : navigate(to, { viewTransition: true, ...options })) as AppRouter['navigate'];

  // 2. The router tells its listeners about each new screen just before it is
  //    drawn, which is the moment the CSS needs to know the direction.
  let current = router.state.location.pathname;
  router.subscribe((state) => {
    const next = state.location.pathname;
    if (next === current) return;
    document.documentElement.dataset.nav = transitionKind(current, next);
    current = next;
  });
}
