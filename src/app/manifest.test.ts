// Installing the app (README, "Install on iPhone"): the manifest has what
// phones need, every icon it names exists at the size it says, and
// index.html points at them. A typo here wouldn't show anywhere until
// someone tried to install the app.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicDir = resolve(process.cwd(), 'public');
const manifest = JSON.parse(readFileSync(resolve(publicDir, 'manifest.webmanifest'), 'utf8'));
const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

/** A PNG's width and height, from its header (bytes 16–23). */
function pngSize(path: string): [number, number] {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe('the web app manifest', () => {
  it('opens full screen at the app, wherever the app is hosted', () => {
    expect(manifest.display).toBe('standalone');
    // Relative, so it works at / (Vercel) and at /<repo>/ (GitHub Pages).
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });

  it('has a 192 and a 512 icon, and a maskable one, each the size it says', () => {
    const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
    expect(purposes).toContain('maskable');
    for (const icon of manifest.icons as { src: string; sizes: string }[]) {
      expect(icon.src.startsWith('/'), icon.src).toBe(false);
      const file = resolve(publicDir, icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const [width, height] = icon.sizes.split('x').map(Number);
      expect(pngSize(file)).toEqual([width, height]);
    }
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  });
});

describe('index.html', () => {
  it('links the manifest and a 180 × 180 home screen icon for iPhones', () => {
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(indexHtml).toContain(
      '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
    );
    expect(pngSize(resolve(publicDir, 'icons/apple-touch-icon.png'))).toEqual([180, 180]);
  });

  it('opens full screen on an iPhone, under the status bar', () => {
    expect(indexHtml).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(indexHtml).toContain('name="apple-mobile-web-app-title"');
    expect(indexHtml).toContain('viewport-fit=cover');
  });

  it('has a launch screen for every image it links, dark and light', () => {
    const links = [...indexHtml.matchAll(/href="\/(icons\/startup\/[^"]+)"/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((link) => link.endsWith('-dark.png'))).toBe(true);
    expect(links.some((link) => link.endsWith('-light.png'))).toBe(true);
    for (const link of links) expect(existsSync(resolve(publicDir, link)), link).toBe(true);
  });
});
