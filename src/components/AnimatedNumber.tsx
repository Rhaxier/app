// A number that rolls to its new value: up when it grows, down when it
// shrinks (counts on buttons and stats, e.g. "Me too · 3"). Screen readers get
// the plain number once; the rolling copies are hidden from them. With reduced
// motion it simply fades (MotionConfig in App.tsx).
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { spring } from '@/lib/motion';
import styles from './AnimatedNumber.module.css';

export function AnimatedNumber({ value }: { value: number }) {
  // Which way it last moved, worked out when the value changes.
  const [last, setLast] = useState({ value, direction: 1 });
  if (last.value !== value) setLast({ value, direction: value > last.value ? 1 : -1 });
  const direction = last.direction;

  return (
    <span className={styles.number}>
      <span className="visually-hidden">{value}</span>
      <span className={styles.roll} aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.span
            key={value}
            className={styles.digit}
            custom={direction}
            initial={{ y: `${direction * 70}%`, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: `${direction * -70}%`, opacity: 0 }}
            transition={spring.pop}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
