// The loading screen: the school's crest and name, shown from the very first
// paint (it's plain HTML in index.html, so it appears before the app's code
// has even downloaded) until the first real screen is ready, then faded out.
//
// "Ready" means: the app has drawn its first screen (RootLayout calls
// releaseSplash) and nothing is still waiting for the sign-in check
// (FullPageLoading in guards.tsx holds it while it runs). It also stays up
// for at least MIN_MS from the start, so a fast start shows the crest
// settling in rather than flashing it.
//
// The crest and name come from Admin > System > Branding. They're remembered
// on this device (rememberBrand, from Branding.tsx) so the next start can show
// them straight away; before the first visit has loaded them, index.html
// shows the crest bundled with the app (public/brand/school-crest.webp).

/** Where index.html finds the remembered crest and name (keep the two in step). */
export const BRAND_STORAGE_KEY = 'campus-brand';

/** The shortest time the loading screen is up, from the start of the page load. */
const MIN_MS = 700;
/** As long as its fade in index.html (#splash transition), plus a margin. */
const FADE_MS = 400;

let holds = 0;
let released = false;
let finished = false;

/** Keeps the loading screen up until the returned function is called. */
export function holdSplash(): () => void {
  holds += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    holds -= 1;
    finishIfReady();
  };
}

/** The app has drawn its first screen: the loading screen can go once nothing holds it. */
export function releaseSplash(): void {
  released = true;
  finishIfReady();
}

function finishIfReady(): void {
  if (finished || !released || holds > 0) return;
  finished = true;
  const splash = document.getElementById('splash');
  if (!splash) return;
  const wait = Math.max(0, MIN_MS - performance.now());
  window.setTimeout(() => {
    // Wait for a frame first: the screen underneath is drawn before the fade.
    requestAnimationFrame(() => {
      splash.classList.add('out');
      window.setTimeout(() => splash.remove(), FADE_MS);
    });
  }, wait);
}

/** Remembers the school's crest and name for the next start's loading screen. */
export function rememberBrand(brand: { logo: string | null; name: string | null }): void {
  try {
    localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(brand));
  } catch {
    // Storage blocked (a private window): the bundled crest is shown instead.
  }
  // Fetch a new crest now, so next time it's already on the device.
  if (brand.logo) {
    const image = new Image();
    image.src = brand.logo;
  }
}
