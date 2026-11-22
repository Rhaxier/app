// "To install: tap Share, then Add to Home Screen": a small card for people
// using the app in Safari on an iPhone or iPad, who could have it on their
// Home Screen instead (README, "Install on iPhone"). Who sees it, and why:
// src/lib/install.ts. Closing it hides it on this device for good.
//
// It sits on the sign-in screen (installing before signing in means signing
// in once: the installed app keeps its own sign-in, apart from Safari's) and
// under the greeting on Home.
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import {
  currentBrowser,
  dismissInstallHint,
  installHintDismissed,
  shouldShowInstallHint,
} from '@/lib/install';
import { fade } from '@/lib/motion';
import styles from './InstallHint.module.css';

export function InstallHint() {
  const [shown, setShown] = useState(() =>
    shouldShowInstallHint(currentBrowser(), installHintDismissed()),
  );

  return (
    <AnimatePresence initial={false}>
      {shown && (
        <motion.aside
          className={styles.hint}
          aria-label="Install the app"
          exit={{ opacity: 0 }}
          transition={fade}
        >
          <span className={styles.icon}>
            <Icon name="share" size={22} />
          </span>
          <div className={styles.text}>
            <p className={styles.title}>To install: tap Share, then Add to Home Screen</p>
            <p className="meta">Don’t see Share? Tap ••• first.</p>
          </div>
          <button
            type="button"
            className={`${styles.close} pressable`}
            aria-label="Hide this tip"
            onClick={() => {
              dismissInstallHint();
              setShown(false);
            }}
          >
            <Icon name="close" size={18} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
