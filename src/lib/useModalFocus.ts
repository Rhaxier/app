// Focus for anything modal (a sheet, the search overlay): while it's open it
// takes focus, Tab stays inside it, Escape closes it, and when it closes focus
// goes back to whatever opened it.
//
// Modals can open on top of each other ("Are you sure?" over an editor). Only
// the top one answers Escape and keeps Tab inside it.
import { useEffect, useRef, type RefObject } from 'react';

const openModals: HTMLElement[] = [];

const FOCUSABLE =
  'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function useModalFocus(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  /** What gets focus on opening (e.g. the search field); the panel itself if not given. */
  initialFocus?: RefObject<HTMLElement | null>,
) {
  // Parents usually pass a new onClose function on every render. Keeping the
  // latest one in a ref means the effect below runs only when the modal opens
  // or closes. (If onClose were a dependency, every keystroke in a field
  // inside it would re-run the effect and throw focus out of the field.)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openModals.push(panel);
    (initialFocus?.current ?? panel).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (openModals[openModals.length - 1] !== panel) return;
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      // Keep Tab inside: from the last item wrap to the first, and back.
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = panel.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openModals.splice(openModals.indexOf(panel), 1);
      previouslyFocused?.focus();
    };
    // The refs never change; listing them keeps the rule simple to check.
  }, [open, panelRef, initialFocus]);
}
