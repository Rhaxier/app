// Light and dark mode.
//
// Dark is the design's default (tokens.css, :root). Light mode is the `.light`
// class on <html>, which swaps every colour token at once. People choose
// System, Dark or Light under Me > Appearance; "System" follows the phone or
// laptop's own setting and changes with it, even while the app is open.
//
// The choice is a per-device convenience, so it lives in localStorage, not
// the database. If storage is blocked (some private windows) the app simply
// follows the system.
//
// index.html runs a tiny copy of resolveTheme() before the app loads, so the
// first paint is already in the right colours. Keep the two in step.
import { useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'dark' | 'light';
export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'campus-theme';
const LIGHT_QUERY = '(prefers-color-scheme: light)';

/** The browser's top bar colour, matching --paper in each theme. */
const THEME_COLOR: Record<Theme, string> = { dark: '#000000', light: '#f2f2f7' };

export const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

/** Which theme to show, given the person's choice and their device's setting. */
export function resolveTheme(preference: ThemePreference, systemPrefersLight: boolean): Theme {
  if (preference === 'system') return systemPrefersLight ? 'light' : 'dark';
  return preference;
}

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'dark' || value === 'light';
}

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersLight(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(LIGHT_QUERY).matches;
}

/** Puts the chosen theme on the page: the .light class and the browser bar colour. */
export function applyTheme(preference: ThemePreference = getThemePreference()): Theme {
  const theme = resolveTheme(preference, systemPrefersLight());
  document.documentElement.classList.toggle('light', theme === 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  return theme;
}

// Screens showing the current choice (the Appearance control) re-render when it changes.
const listeners = new Set<() => void>();

export function setThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked: the choice lasts until the page reloads.
  }
  applyTheme(preference);
  listeners.forEach((listener) => listener());
}

/** Re-applies "System" when the device switches between light and dark. Call once at start-up. */
export function watchSystemTheme(): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const list = window.matchMedia(LIGHT_QUERY);
  const onChange = () => {
    if (getThemePreference() === 'system') applyTheme('system');
  };
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

/** The person's choice, for the Appearance control: [preference, setPreference]. */
export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const preference = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getThemePreference,
    () => 'system' as const,
  );
  return [preference, setThemePreference];
}
