// Who sees the "Add to Home Screen" hint (install.ts): Safari on an iPhone or
// iPad, not yet installed, not closed before. Everyone else never does.
import { describe, expect, it } from 'vitest';
import { isIosSafari, shouldShowInstallHint, type BrowserInfo } from './install';

const UA = {
  iPhoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  // iPads ask for desktop sites and say they're a Mac.
  iPadSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  chromeOnIPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1',
  firefoxOnIPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/141.0 Mobile/15E148 Safari/605.1.15',
  googleAppOnIPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/375.0.779824 Mobile/15E148 Safari/604.1',
  inAppBrowser:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 389.0.0.0',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
};

function browser(overrides: Partial<BrowserInfo>): BrowserInfo {
  return {
    userAgent: UA.iPhoneSafari,
    maxTouchPoints: 5,
    standalone: false,
    native: false,
    ...overrides,
  };
}

describe('isIosSafari', () => {
  it('knows Safari on an iPhone, and on an iPad that says it is a Mac', () => {
    expect(isIosSafari(UA.iPhoneSafari, 5)).toBe(true);
    expect(isIosSafari(UA.iPadSafari, 5)).toBe(true);
  });

  it('leaves out a real Mac (no touch screen)', () => {
    expect(isIosSafari(UA.iPadSafari, 0)).toBe(false);
  });

  it('leaves out other browsers and in-app browsers on iPhone, which cannot install', () => {
    expect(isIosSafari(UA.chromeOnIPhone, 5)).toBe(false);
    expect(isIosSafari(UA.firefoxOnIPhone, 5)).toBe(false);
    expect(isIosSafari(UA.googleAppOnIPhone, 5)).toBe(false);
    expect(isIosSafari(UA.inAppBrowser, 5)).toBe(false);
  });

  it('leaves out Android and desktop browsers', () => {
    expect(isIosSafari(UA.androidChrome, 5)).toBe(false);
    expect(isIosSafari(UA.windowsEdge, 0)).toBe(false);
  });
});

describe('shouldShowInstallHint', () => {
  it('shows in iPhone Safari before installing', () => {
    expect(shouldShowInstallHint(browser({}), false)).toBe(true);
  });

  it('never shows in the installed app', () => {
    expect(shouldShowInstallHint(browser({ standalone: true }), false)).toBe(false);
  });

  it('never shows in the Capacitor phone app', () => {
    expect(shouldShowInstallHint(browser({ native: true }), false)).toBe(false);
  });

  it('stays hidden once someone has closed it', () => {
    expect(shouldShowInstallHint(browser({}), true)).toBe(false);
  });

  it('never shows outside iPhone and iPad Safari', () => {
    expect(shouldShowInstallHint(browser({ userAgent: UA.androidChrome }), false)).toBe(false);
  });
});
