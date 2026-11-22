// Which layout the app uses on this screen: phone, tablet or laptop. The one
// place the breakpoints live (docs/ARCHITECTURE.md, "Screen sizes").
//
//   phone   the design's 390px layout: a centred column and the bottom tab bar
//   tablet  744px wide and up: a glass icon rail on the left (iPad portrait)
//   laptop  1024px wide and up: the rail grows into a sidebar with labels
//
// Why these numbers: 1024 is Tailwind's `lg`. The tablet starts at 744
// rather than Tailwind's `md` (768) so that an iPad mini held upright (744px)
// gets the tablet layout too. Both also need 500px of height: an iPhone
// turned sideways is 844–956px wide but only about 430px tall, and keeps the
// phone layout it had before.
//
// CSS that needs the same breakpoints repeats these queries word for word
// (search for "744px"); most screen CSS doesn't, because screens respond to
// their own width with container queries (see `.main` in AppLayout.module.css).
import { useMediaQuery } from './useMediaQuery';

export const TABLET_QUERY = '(min-width: 744px) and (min-height: 500px)';
export const LAPTOP_QUERY = '(min-width: 1024px) and (min-height: 500px)';

export type LayoutMode = 'phone' | 'tablet' | 'laptop';

/**
 * The room the side navigation takes from the left edge, in px: the same as
 * --nav-space in tokens.css (16px inset + the rail or sidebar). For code that
 * must place things in px, such as fitting the map's plan beside it.
 */
export const NAV_SPACE: Record<LayoutMode, number> = {
  phone: 0,
  tablet: 16 + 72,
  laptop: 16 + 232,
};

/** The layout for this screen size. Re-renders when the window is resized or turned. */
export function useLayoutMode(): LayoutMode {
  const tablet = useMediaQuery(TABLET_QUERY);
  const laptop = useMediaQuery(LAPTOP_QUERY);
  if (laptop) return 'laptop';
  return tablet ? 'tablet' : 'phone';
}

/** True on tablets and laptops: anything that has the side navigation. */
export function useWideLayout(): boolean {
  return useMediaQuery(TABLET_QUERY);
}
