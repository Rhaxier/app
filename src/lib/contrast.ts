// Colour contrast (WCAG 2), for the school's accent colour. White text sits on
// the accent (the Request and Ask to join buttons), so it must reach 4.5:1.
// The database checks the same rule (app_settings_check_branding); this gives
// the admin the answer while they type, with the reason. brandAccents() then
// derives what each theme needs from that one colour.

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

/** '#0a84ff', 0.18 → 'rgba(10, 132, 255, 0.18)': the colour, see-through. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The dark theme's card colour (--card in tokens.css), which accent text sits on. */
const DARK_CARD = '#1c1c1e';

/**
 * The school colour for dark mode. A colour dark enough for white text in
 * light mode is usually too dark to read on a black screen, so it is mixed
 * with white until accent-coloured text on a card reaches 4.5:1, which is
 * about where the design's own system blue sits.
 */
export function accentForDark(hex: string): string {
  for (const share of [1, 0.85, 0.7, 0.55, 0.4, 0.25]) {
    const lighter = tint(hex, share);
    if (contrastRatio(lighter, DARK_CARD) >= MIN_CONTRAST) return lighter;
  }
  return tint(hex, 0.1);
}

/**
 * Everything the app needs from a school colour, for both themes (see
 * src/app/Branding.tsx). The soft tints use the same strengths as the
 * design's blue: 11% in light mode, 18% in dark.
 */
export function brandAccents(hex: string) {
  const dark = accentForDark(hex);
  return {
    light: hex,
    lightSoft: withAlpha(hex, 0.11),
    dark,
    darkSoft: withAlpha(dark, 0.18),
  };
}
