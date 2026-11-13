// The accent colour check (the database applies the same 4.5:1 rule).
import { describe, expect, it } from 'vitest';
import { accentProblem, brandAccents, contrastRatio } from './contrast';

describe('accentProblem (the accent colour validator)', () => {
  it('accepts the design teal and other dark colours', () => {
    expect(contrastRatio('#0e6857', '#ffffff')).toBeCloseTo(6.7, 1);
    expect(accentProblem('#0e6857')).toBeNull();
    expect(accentProblem('#1F4E79')).toBeNull();
  });

  it('rejects low-contrast colours and says why', () => {
    expect(accentProblem('#7fd1c1')).toBe(
      'White text on #7fd1c1 has a contrast of only 1.78:1; it needs at least 4.5:1 to be readable. Choose a darker colour.',
    );
    expect(accentProblem('#ffff00')).toMatch(/needs at least 4.5:1/);
  });

  it('rejects things that are not colours', () => {
    expect(accentProblem('teal')).toBe(
      'Use a colour like #0e6857 (a # and six letters or digits).',
    );
  });
});

describe('brandAccents (a school colour in both themes)', () => {
  it('keeps the colour itself for light mode, with an 11% tint', () => {
    const brand = brandAccents('#0e6857');
    expect(brand.light).toBe('#0e6857');
    expect(brand.lightSoft).toBe('rgba(14, 104, 87, 0.11)');
  });

  it('lightens it for dark mode until text in it reads on a dark card', () => {
    for (const accent of ['#0e6857', '#1f4e79', '#5a3e8c', '#8a5a00']) {
      const brand = brandAccents(accent);
      expect(contrastRatio(brand.dark, '#1c1c1e')).toBeGreaterThanOrEqual(4.5);
      expect(brand.darkSoft).toMatch(/^rgba\(\d+, \d+, \d+, 0\.18\)$/);
    }
  });
});

describe('status badge text on its soft tint (tokens.css)', () => {
  // The badge colours worked out the way the browser draws them: a tint is
  // see-through, so it is blended over the card it sits on, and color-mix()
  // in tokens.css is a straight blend of two colours.
  type Rgb = [number, number, number];
  const hex = (value: string): Rgb =>
    [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) as Rgb;
  const toHex = (rgb: number[]) =>
    `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
  const blend = (a: Rgb, b: Rgb, shareOfA: number) =>
    toHex(a.map((c, i) => c * shareOfA + b[i] * (1 - shareOfA)));
  const white: Rgb = [255, 255, 255];
  const black: Rgb = [0, 0, 0];

  it('reaches 4.5:1 in dark mode, on a #1c1c1e card', () => {
    const card = hex('#1c1c1e');
    const blue = hex('#0a84ff');
    const tint = (colour: string, alpha: number) => blend(hex(colour), card, alpha);
    expect(contrastRatio(blend(blue, white, 0.6), tint('#0a84ff', 0.18))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio('#ffb340', tint('#ff9f0a', 0.16))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#ffd60a', tint('#ffd60a', 0.14))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#30d158', tint('#30d158', 0.15))).toBeGreaterThanOrEqual(4.5);
  });

  it('reaches 4.5:1 in light mode, on a white card', () => {
    const tint = (colour: string, alpha: number) => blend(hex(colour), white, alpha);
    const blue = hex('#007aff');
    expect(contrastRatio(blend(blue, black, 0.8), tint('#007aff', 0.11))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(
      contrastRatio(blend(hex('#b35900'), black, 0.88), tint('#ff9500', 0.13)),
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#8a6100', '#fff3cd')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#1e7a3a', '#e3f5e8')).toBeGreaterThanOrEqual(4.5);
    const quiet = tint('#767680', 0.12);
    expect(contrastRatio(blend(hex('#3c3c43'), hex(quiet), 0.85), quiet)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});
