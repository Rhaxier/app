// Motion tokens: every duration, curve, distance and spring in the app, in one
// file. Motion components (the `motion` package) import the springs below; CSS
// reads the same values as custom properties, which installMotionTokens()
// writes on <html> at start-up (--motion-fast, --ease-out, …). Change a value
// here and both follow.
//
// The feel (design PDF page 11, and Emil Kowalski's animation guidance): fast
// and calm, 150–400ms, springs without bounce except a hint on things you
// point at, one curve everywhere (the deck's cubic-bezier(.2,0,0,1)), and only
// opacity and transform ever animate. With reduced motion, things fade but
// don't move: <MotionConfig reducedMotion="user"> (App.tsx) drops Motion's
// movement, and --motion-shift / --press-scale drop the CSS movement.
import type { Transition } from 'motion/react';

export type MotionToken = 'fast' | 'base' | 'slow';

/** Durations in milliseconds: press feedback, fades, sheets and screens. */
export const duration: Record<MotionToken, number> = { fast: 120, base: 200, slow: 280 };

/** The deck's curve, for everything that arrives (and, CSS-side, leaves). */
export const easeOut = [0.2, 0, 0, 1] as const;
export const easeInOut = [0.4, 0, 0.2, 1] as const;

/** How far things travel: a list item fading up, a screen sliding in. */
export const distance = { shift: 8, page: 28 } as const;

/** Springs ("duration" is how long it takes to settle; bounce 0 = no overshoot). */
export const spring = {
  /** The tab bar lens, segment thumbs, chip pills: quick, with a hint of settle. */
  indicator: { type: 'spring', duration: 0.34, bounce: 0.14 },
  /** Screens sliding in and out: no overshoot. */
  page: { type: 'spring', duration: 0.32, bounce: 0 },
  /** Sheets and the search panel: a touch of weight. */
  sheet: { type: 'spring', duration: 0.4, bounce: 0.08 },
  /** Notification dots and counters popping in. */
  pop: { type: 'spring', duration: 0.3, bounce: 0.22 },
} satisfies Record<string, Transition>;

/** A plain fade, for things that only appear and disappear. */
export const fade: Transition = { duration: duration.base / 1000, ease: easeOut };

/** True when the person has asked their device for less motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Writes the CSS side of these tokens on <html>, and keeps --motion-shift and
 * --press-scale at "no movement" while reduced motion is on. Call once at start-up.
 */
export function installMotionTokens(root: HTMLElement = document.documentElement): void {
  const bezier = (curve: readonly number[]) => `cubic-bezier(${curve.join(', ')})`;
  root.style.setProperty('--motion-fast', `${duration.fast}ms`);
  root.style.setProperty('--motion-base', `${duration.base}ms`);
  root.style.setProperty('--motion-slow', `${duration.slow}ms`);
  root.style.setProperty('--ease-out', bezier(easeOut));
  root.style.setProperty('--ease-in-out', bezier(easeInOut));

  const applyReduced = () => {
    const reduced = prefersReducedMotion();
    root.style.setProperty('--motion-shift', reduced ? '0px' : `${distance.shift}px`);
    root.style.setProperty('--press-scale', reduced ? '1' : '0.97');
  };
  applyReduced();
  if (typeof window.matchMedia === 'function') {
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyReduced);
  }
}

/**
 * A motion token in milliseconds, e.g. motionMs('slow') = 280, for code that
 * waits for a CSS animation to finish. Returns 0 when the tokens aren't
 * installed (as in tests), so callers can skip waiting altogether. Reduced
 * motion still waits: things fade without moving, and the fade takes the same time.
 */
export function motionMs(token: MotionToken): number {
  if (typeof window === 'undefined') return 0;
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--motion-${token}`);
  const ms = parseFloat(value);
  return Number.isFinite(ms) ? ms : 0;
}
