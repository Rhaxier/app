// Entry point: loads fonts and global styles, applies light or dark mode,
// then mounts the app.
//
// Fonts (design PDF page 12): Instrument Sans 400–700 for everything, Geist
// Mono for room codes. They're bundled with the app (Fontsource) rather than
// fetched from Google Fonts, so the phone app works offline.
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/instrument-sans/700.css';
import '@fontsource/geist-mono/500.css';
import 'leaflet/dist/leaflet.css';
import './styles/tokens.css';
import './styles/globals.css';
import './styles/glass.css';
import './styles/motion.css';
// Tailwind, for shadcn/ui components only (see the file's header).
import './styles/tailwind.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { installMotionTokens } from './lib/motion';
import { applyTheme, watchSystemTheme } from './lib/theme';

// index.html already set the theme before the first paint; this keeps the
// browser bar colour right and follows the device when set to "System".
applyTheme();
watchSystemTheme();
// Motion timing for CSS (--motion-*, --ease-*), from src/lib/motion.ts.
installMotionTokens();
// After a new deploy, an open or cached copy of the app can ask for files
// that no longer exist (their names change with every build). Vite reports
// that as "vite:preloadError"; reloading once fetches the new build. The
// session flag stops a reload loop if a file is genuinely missing.
window.addEventListener('vite:preloadError', (event) => {
  if (sessionStorage.getItem('reloaded-after-deploy')) return;
  sessionStorage.setItem('reloaded-after-deploy', '1');
  event.preventDefault();
  window.location.reload();
});
window.addEventListener('load', () => {
  setTimeout(() => sessionStorage.removeItem('reloaded-after-deploy'), 10_000);
});
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
