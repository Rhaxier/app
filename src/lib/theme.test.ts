// Light and dark mode: which theme shows, and that a choice is remembered and applied.
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyTheme,
  getThemePreference,
  resolveTheme,
  setThemePreference,
  THEME_STORAGE_KEY,
} from './theme';

describe('resolveTheme', () => {
  it('follows the device when set to System', () => {
    expect(resolveTheme('system', true)).toBe('light');
    expect(resolveTheme('system', false)).toBe('dark');
  });

  it('keeps an explicit choice whatever the device says', () => {
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('light', false)).toBe('light');
  });
});

describe('the saved choice', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light');
  });

  it('defaults to System, and ignores anything it does not recognise', () => {
    expect(getThemePreference()).toBe('system');
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(getThemePreference()).toBe('system');
  });

  it('remembers Light and puts the .light class on the page', () => {
    setThemePreference('light');
    expect(getThemePreference()).toBe('light');
    expect(document.documentElement).toHaveClass('light');

    setThemePreference('dark');
    expect(document.documentElement).not.toHaveClass('light');
  });

  it('applies the saved choice at start-up', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(applyTheme()).toBe('light');
    expect(document.documentElement).toHaveClass('light');
  });

  it("sets both of index.html's browser bar colours to the chosen theme", () => {
    // index.html has one per system theme; a choice in the app wins over both.
    document.head.innerHTML = `
      <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
      <meta name="theme-color" content="#f2f2f7" media="(prefers-color-scheme: light)" />`;
    const colours = () =>
      [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) =>
        meta.getAttribute('content'),
      );
    setThemePreference('light');
    expect(colours()).toEqual(['#f2f2f7', '#f2f2f7']);
    setThemePreference('dark');
    expect(colours()).toEqual(['#000000', '#000000']);
    document.head.innerHTML = '';
  });
});
