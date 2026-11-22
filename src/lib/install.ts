// Who sees the "Add to Home Screen" hint (src/app/InstallHint.tsx).
//
// iPhones and iPads have no install button: people add a web app to the
// Home Screen from Safari's Share menu, so a short hint is the only way to
// tell them. It shows only where it can work and isn't done yet:
//   * Safari on an iPhone or iPad. Other browsers on iOS, and the browsers
//     inside other apps (mail, social apps), can't install apps this way.
//     iPads say they're a Mac; a touch screen gives them away.
//   * not already the installed app (standalone)
//   * not the Capacitor phone app (that's an app already)
//   * not after someone has closed it on this device (remembered)
import { Capacitor } from '@capacitor/core';

export const INSTALL_HINT_KEY = 'campus-install-hint-dismissed';

export interface BrowserInfo {
  userAgent: string;
  /** Touch points: more than 1 on an iPad that reports itself as a Mac. */
  maxTouchPoints: number;
  /** Already running as the installed app. */
  standalone: boolean;
  /** Running inside the Capacitor phone app. */
  native: boolean;
}

/** Safari on an iPhone, iPod or iPad. */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  const ios =
    /iPhone|iPod|iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (!ios) return false;
  // Safari says "Version/… Safari/…". Other browsers add their own name, and
  // in-app browsers usually leave out "Safari/".
  const safari = /Version\/[\d.]+.*Safari\//.test(userAgent);
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|YaBrowser|Brave/.test(
    userAgent,
  );
  return safari && !otherBrowser;
}

export function shouldShowInstallHint(browser: BrowserInfo, dismissed: boolean): boolean {
  if (dismissed || browser.standalone || browser.native) return false;
  return isIosSafari(browser.userAgent, browser.maxTouchPoints);
}

/** This browser, right now. */
export function currentBrowser(): BrowserInfo {
  const nav = navigator as Navigator & { standalone?: boolean };
  const displayStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  return {
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    // navigator.standalone is Safari's own flag for an app opened from the Home Screen.
    standalone: nav.standalone === true || displayStandalone,
    native: Capacitor.isNativePlatform(),
  };
}

export function installHintDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_HINT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function dismissInstallHint(): void {
  try {
    localStorage.setItem(INSTALL_HINT_KEY, 'true');
  } catch {
    // Storage blocked (some private windows): it's hidden until the page reloads.
  }
}
