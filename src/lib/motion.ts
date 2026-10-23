// Motion helpers for the few animations JavaScript has to know about: things
// that must stay on screen while they animate away (a closing sheet, a toast,
// a list item that was removed). Durations come from the motion tokens in
// src/styles/tokens.css, so CSS and JavaScript always agree.

export type MotionToken = 'fast' | 'base' | 'slow';

/** True when the person has asked their device for less motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A motion token in milliseconds, e.g. motionMs('slow') = 280. Returns 0 when
 * animations won't run (reduced motion, or no styles loaded, as in tests), so
 * callers can skip waiting altogether.
 */
export function motionMs(token: MotionToken): number {
  if (typeof window === 'undefined' || prefersReducedMotion()) return 0;
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--motion-${token}`);
  const ms = parseFloat(value);
  return Number.isFinite(ms) ? ms : 0;
}
