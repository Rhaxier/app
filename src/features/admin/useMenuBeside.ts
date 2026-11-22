// Does the admin menu sit beside the sections (AdminLayout), or is it its own
// screen with each section opening full-width and a back link (AdminPage)?
//
//   laptop  beside (src/lib/layout.ts)
//   tablet  its own screen: an upright iPad's width goes to the section
//   phone   its own screen, except a phone 900px wide or more (a large iPhone
//           turned sideways), which has always had the menu beside
import { useLayoutMode } from '@/lib/layout';
import { useMediaQuery } from '@/lib/useMediaQuery';

export function useMenuBeside(): boolean {
  const mode = useLayoutMode();
  const wideEnough = useMediaQuery('(min-width: 900px)');
  return mode === 'laptop' || (mode === 'phone' && wideEnough);
}
