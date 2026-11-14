// Search as an overlay over the current screen (iOS-style). From the round
// search button it grows out of the button itself (a shared-layout morph: the
// button and the panel carry the same layoutId), its contents sharpen from a
// soft blur, and the results fade up one after another. Closing plays it
// backwards, into the button. From another search button it scales up from
// the middle; from ⌘K / Ctrl+K it simply appears (a shortcut should be instant).
//
// It's modal: focus starts in the field, Tab stays inside, Escape or a tap
// outside closes it, and focus goes back to what opened it (useModalFocus).
import { AnimatePresence, motion, type TargetAndTransition } from 'motion/react';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { fade, spring } from '@/lib/motion';
import { useModalFocus } from '@/lib/useModalFocus';
import { SEARCH_MORPH_ID, type SearchOrigin } from '../context';
import { SearchPanel } from './SearchPanel';
import styles from './SearchOverlay.module.css';

interface SearchOverlayProps {
  open: boolean;
  origin: SearchOrigin;
  onClose: () => void;
}

const instantly: TargetAndTransition = { opacity: 0, transition: { duration: 0 } };

export function SearchOverlay({ open, origin, onClose }: SearchOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useModalFocus(open, panelRef, onClose, inputRef);
  const instant = origin === 'keyboard';
  const morph = origin === 'button';

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={styles.layer} key="search">
          <motion.span
            className={styles.scrim}
            aria-hidden="true"
            onClick={onClose}
            initial={instant ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={instant ? instantly : { opacity: 0 }}
            transition={fade}
          />
          <motion.div
            ref={panelRef}
            className={`glass thick ${styles.panel}`}
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            tabIndex={-1}
            layoutId={morph ? SEARCH_MORPH_ID : undefined}
            // Motion animates the corner radius with the morph only when it's set here.
            style={{ borderRadius: 32 }}
            initial={instant ? false : morph ? undefined : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={instant ? instantly : { opacity: 0, scale: morph ? 1 : 0.96 }}
            transition={spring.sheet}
          >
            <motion.div
              className={styles.content}
              initial={instant ? false : { opacity: 0, filter: 'blur(8px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={instant ? instantly : { opacity: 0, filter: 'blur(8px)' }}
              transition={{ ...fade, delay: morph ? 0.08 : 0 }}
            >
              <div className={styles.top}>
                <h2 className="visually-hidden">Search</h2>
                <SearchPanel inputRef={inputRef} onPick={onClose} />
              </div>
              <button type="button" className={`${styles.cancel} pressable`} onClick={onClose}>
                Cancel
              </button>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
