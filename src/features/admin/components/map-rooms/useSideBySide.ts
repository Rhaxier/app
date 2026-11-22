// Map and rooms (both tabs): is there room for the map beside the list and
// the editor? If not, they stack and the editor opens in a sheet (a dialog on
// a tablet). The CSS (.wide in MapRooms.module.css and Connectors.module.css)
// and the editor's card-or-sheet choice both follow this one answer, so
// they can't disagree.
//
// On a tablet or laptop it's the room the section really has, after the side
// navigation and the admin menu (useElementWidth). On a phone it stays what
// it always was: a window 900px wide or more (a large iPhone turned sideways).
import { useLayoutMode } from '@/lib/layout';
import { useElementWidth } from '@/lib/useElementWidth';
import { useMediaQuery } from '@/lib/useMediaQuery';

/**
 * `minimum`: the section width (px) from which the map sits beside the list.
 * Classrooms uses a little less than Stairs and lifts: picking a room needs a
 * smaller map than placing a staircase, which gets the full width until
 * there's room for a large canvas beside the panels.
 */
export function useSideBySide(
  minimum: number,
): [(element: HTMLDivElement | null) => void, boolean] {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const mode = useLayoutMode();
  const wideWindow = useMediaQuery('(min-width: 900px)');
  return [ref, mode === 'phone' ? wideWindow : width >= minimum];
}
