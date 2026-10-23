// A panel that slides up from the bottom over the screen (a modal "bottom sheet").
// Used for quick actions such as "Send back with a note". When it opens it
// takes focus; Tab stays inside it; Escape or a tap outside closes it; and
// focus goes back to whatever opened it.
//
// Motion: the backdrop fades in while the panel slides up (--motion-slow), and
// closing plays the same in reverse. To have time for that, the sheet stays on
// screen a moment after `open` turns false (usePresence), showing what it
// showed last. Render <Sheet open={…}> rather than {open && <Sheet open>},
// or there is nothing left to animate.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { usePresence } from '@/lib/usePresence';
import { Icon } from './Icon';
import styles from './Sheet.module.css';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Sheets can open on top of each other (a "Are you sure?" over an editor).
// Only the top one answers Escape and keeps Tab inside it.
const openSheets: HTMLElement[] = [];

const FOCUSABLE =
  'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function Sheet({ open, title, onClose, children }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const { mounted, leaving } = usePresence(open, 'slow');

  // While closing, keep showing the last open content: the parent may already
  // have cleared what it was about (e.g. the role being signed up for).
  const shown = useRef({ title, children });
  useEffect(() => {
    if (open) shown.current = { title, children };
  });

  // Parents usually pass a new onClose function on every render. Keeping the
  // latest one in a ref means the effect below runs only when the sheet opens
  // or closes. (If onClose were a dependency, every keystroke in a field
  // inside the sheet would re-run it and throw focus out of the field.)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openSheets.push(panel);
    panel.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (openSheets[openSheets.length - 1] !== panel) return;
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      // Keep Tab inside the sheet: from the last item wrap to the first, and back.
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = panelRef.current.contains(document.activeElement);
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
      openSheets.splice(openSheets.indexOf(panel), 1);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!mounted) return null;
  const content = leaving ? shown.current : { title, children };

  return (
    <div
      className={styles.backdrop}
      data-state={leaving ? 'closing' : 'open'}
      onClick={leaving ? undefined : onClose}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        // Clicks inside the panel must not reach the backdrop and close it.
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id={titleId}>{content.title}</h2>
          <button
            type="button"
            className={`${styles.close} pressable`}
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </div>
        {content.children}
      </div>
    </div>
  );
}
