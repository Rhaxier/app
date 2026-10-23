// Animates items arriving in and leaving a list, without animating the whole
// list when it first loads.
//
//   const rows = useListMotion(notifications, (n) => n.id);
//   rows.map(({ item, key, motion }) => <li key={key} className={motion}>…</li>)
//
// `motion` is a class from src/styles/motion.css:
//   ''       the item was there when the list first loaded: no animation
//   'enter'  it arrived later (e.g. over Realtime): fade and slide in, once
//   'leave'  it was just removed: it stays for a moment while it fades out
import { useEffect, useRef, useState } from 'react';
import { motionMs } from './motion';

export interface MotionRow<T> {
  item: T;
  key: string;
  motion: '' | 'enter' | 'leave';
}

export function useListMotion<T>(
  items: T[] | undefined,
  keyOf: (item: T) => string,
): MotionRow<T>[] {
  // Keys present on first load never animate in.
  const initialKeys = useRef<Set<string> | null>(null);
  // The rows drawn last time, so a removed item can be drawn once more as 'leave'.
  const lastRows = useRef<MotionRow<T>[]>([]);
  // Removed items whose fade-out has finished.
  const [gone, setGone] = useState<Set<string>>(() => new Set());

  if (items && initialKeys.current === null) initialKeys.current = new Set(items.map(keyOf));
  const fadeMs = motionMs('base');

  const rows: MotionRow<T>[] = (items ?? []).map((item) => {
    const key = keyOf(item);
    const isNew = initialKeys.current !== null && !initialKeys.current.has(key);
    return { item, key, motion: isNew ? 'enter' : '' };
  });

  // Put each removed item back where it was, marked 'leave', until it has faded.
  if (fadeMs > 0) {
    const current = new Set(rows.map((row) => row.key));
    lastRows.current.forEach((row, index) => {
      if (current.has(row.key) || gone.has(row.key)) return;
      rows.splice(Math.min(index, rows.length), 0, { ...row, motion: 'leave' });
    });
  }

  const leavingKeys = rows
    .filter((row) => row.motion === 'leave')
    .map((row) => row.key)
    .join(',');

  useEffect(() => {
    lastRows.current = rows;
  });

  useEffect(() => {
    if (!leavingKeys) return;
    const timer = window.setTimeout(() => {
      setGone((previous) => new Set([...previous, ...leavingKeys.split(',')]));
    }, fadeMs);
    return () => window.clearTimeout(timer);
  }, [leavingKeys, fadeMs]);

  return rows;
}
