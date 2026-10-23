// The accent colour check (the database applies the same 4.5:1 rule).
import { describe, expect, it } from 'vitest';
import { accentProblem, accentSoftFor, contrastRatio } from './contrast';

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

describe('accentSoftFor', () => {
  it('picks a pale background that keeps accent-coloured text readable', () => {
    for (const accent of ['#0e6857', '#1f4e79', '#5a3e8c', '#8a5a00']) {
      expect(contrastRatio(accent, accentSoftFor(accent))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
