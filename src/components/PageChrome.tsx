// Fixed chrome that belongs to one screen: the full-screen map and its
// floating controls, the booking bar. Screens slide when you drill in or come
// back (src/app/screenTransitions.ts), and anything inside a moving layer
// that is position: fixed would be pinned to that layer instead of the
// screen and jump. So this draws its children at the end of <body> (a
// portal), where they stay put, and fades them in and out with their screen.
import { motion, useIsPresent } from 'motion/react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { fade } from '@/lib/motion';

interface PageChromeProps {
  children: ReactNode;
  /** Data attributes for CSS that reacts to the screen's state, e.g. data-sheet. */
  attributes?: Record<`data-${string}`, string | boolean | undefined>;
}

export function PageChrome({ children, attributes }: PageChromeProps) {
  // False while the screen is leaving: fade out together with it.
  const present = useIsPresent();
  return createPortal(
    <motion.div
      {...attributes}
      initial={{ opacity: 0 }}
      animate={{ opacity: present ? 1 : 0 }}
      transition={fade}
    >
      {children}
    </motion.div>,
    document.body,
  );
}
