// Colour contrast (WCAG 2), for the school's accent colour. White text sits on
// the accent (buttons, the pinned announcement), so it must reach 4.5:1. The
// database checks the same rule (app_settings_check_branding); this gives the
// admin the answer while they type, with the reason.

/** '#0e6857' → its relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** How readable one colour is on the other: 1 (not at all) to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export const MIN_CONTRAST = 4.5;
const HEX = /^#[0-9a-f]{6}$/i;

/** Null if the accent works, otherwise why not, in words. */
export function accentProblem(hex: string): string | null {
  if (!HEX.test(hex)) return 'Use a colour like #0e6857 (a # and six letters or digits).';
  const ratio = contrastRatio(hex, '#ffffff');
  if (ratio < MIN_CONTRAST) {
    return `White text on ${hex.toLowerCase()} has a contrast of only ${ratio.toFixed(2)}:1; it needs at least 4.5:1 to be readable. Choose a darker colour.`;
  }
  return null;
}

/** Mixes a colour with white: share 0.12 = 12% colour, 88% white. */
export function tint(hex: string, share: number): string {
  const mixed = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(255 - (255 - channel) * share)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${mixed.join('')}`;
}

/**
 * The pale background for "good" badges and chips, which carry text in the
 * accent colour. Starts as a soft tint and gets paler until that text is
 * readable (at worst plain white, where accentProblem() already guarantees 4.5:1).
 */
export function accentSoftFor(hex: string): string {
  for (const share of [0.15, 0.12, 0.09, 0.06, 0.03]) {
    const soft = tint(hex, share);
    if (contrastRatio(hex, soft) >= MIN_CONTRAST) return soft;
  }
  return '#ffffff';
}
