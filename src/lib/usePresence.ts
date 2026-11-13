// Keeps something on screen long enough to animate away.
//
// React removes an element the moment we stop rendering it, so there is no
// time for a closing animation. usePresence(show) answers two questions:
//   mounted  should it be rendered at all?
//   leaving  is it on its way out (play the exit animation)?
// When `show` turns false, `mounted` stays true for one motion token's length,
// then turns false. In tests (no styles, so no animation) it turns false at once.
import { useEffect, useState } from 'react';
import { motionMs, type MotionToken } from './motion';

export function usePresence(show: boolean, exit: MotionToken = 'base') {
  const [mounted, setMounted] = useState(show);
  const [previousShow, setPreviousShow] = useState(show);

  // React's "adjust state while rendering" pattern: when `show` changes, update
  // straight away rather than one render later.
  if (show !== previousShow) {
    setPreviousShow(show);
    if (show) setMounted(true);
    else if (motionMs(exit) === 0) setMounted(false);
  }

  useEffect(() => {
    if (show || !mounted) return;
    const timer = window.setTimeout(() => setMounted(false), motionMs(exit));
    return () => window.clearTimeout(timer);
  }, [show, mounted, exit]);

  return { mounted, leaving: mounted && !show };
}
