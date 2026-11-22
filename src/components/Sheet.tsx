// A panel that rises from the bottom over the screen (a modal "bottom sheet").
// Used for quick actions such as "Send back with a note". When it opens it
// takes focus; Tab stays inside it; Escape or a tap outside closes it; and
// focus goes back to whatever opened it (useModalFocus).
//
// Look: the "thick" liquid glass (design PDF page 10), radius 32, floating a
// little in from the screen edges. The title stays put while a long sheet
// scrolls. The dimmed backdrop is not glass: never glass on glass.
//
// It's drawn at the end of <body> (a portal), wherever it's used: cards are
// glass, and a blurred ancestor would turn the sheet's full-screen
// position: fixed into "fixed inside that card".
//
// Motion: the sheet springs up from below while the backdrop fades in, and
// leaves the way it came (spring.sheet in src/lib/motion.ts). With reduced
// motion it only fades. While it leaves, AnimatePresence keeps showing what it
// showed last, even if the parent has already cleared it. Render
// <Sheet open={…}> rather than {open && <Sheet open>}, or there is nothing
// left to animate.
//
// On tablets and laptops (src/lib/layout.ts) a sheet rising from the bottom
// edge of a big screen is a long way from where you're looking, so the same
// panel is a dialog in the middle instead: no grab bar, and it grows in from
// slightly smaller rather than sliding up.
import { AnimatePresence, motion, type TargetAndTransition } from 'motion/react';
import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useWideLayout } from '@/lib/layout';
import { fade, spring } from '@/lib/motion';
import { useModalFocus } from '@/lib/useModalFocus';
import { Icon } from './Icon';
import styles from './Sheet.module.css';

// Where the panel comes from and goes to: below the screen, or (as a dialog)
// a touch smaller and lower, where it is.
const hiddenSheet: TargetAndTransition = { y: '110%', opacity: 0 };
const hiddenDialog: TargetAndTransition = { y: 12, scale: 0.96, opacity: 0 };

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ open, title, onClose, children }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useModalFocus(open, panelRef, onClose);
  const dialog = useWideLayout();
  const hidden = dialog ? hiddenDialog : hiddenSheet;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={`${styles.backdrop} ${dialog ? styles.dialog : ''}`}
          onClick={onClose}
          // The backdrop only holds the dimming (below) and the panel; it
          // doesn't fade itself, so the glass panel can blur the screen behind.
          exit={{ pointerEvents: 'none' }}
        >
          <motion.span
            className={styles.scrim}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
          />
          <motion.div
            ref={panelRef}
            className={`glass thick ${styles.panel}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            data-variant={dialog ? 'dialog' : 'sheet'}
            initial={hidden}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={hidden}
            transition={{ ...spring.sheet, opacity: fade }}
            // Clicks inside the panel must not reach the backdrop and close it.
            onClick={(event) => event.stopPropagation()}
          >
            <span className={styles.grabber} aria-hidden="true" />
            <div className={styles.header}>
              <h2 id={titleId}>{title}</h2>
              <button
                type="button"
                className={`${styles.close} pressable`}
                onClick={onClose}
                aria-label="Close"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className={styles.body}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
