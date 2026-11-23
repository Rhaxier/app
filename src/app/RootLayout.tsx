// Wraps every route, signed in or not: the school's branding, any maintenance
// notice, and (in dev mode) the dev role switcher, including on sign-in. Its
// first appearance is also what lets the loading screen go (src/lib/splash.ts).
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { env } from '@/lib/env';
import { releaseSplash } from '@/lib/splash';
import { Branding, MaintenanceBanner } from './Branding';
import { DevRoleSwitcher } from './DevRoleSwitcher';

export function RootLayout() {
  // Effects run children first, so a sign-in check below has already held
  // the loading screen by now if it's still running.
  useEffect(() => releaseSplash(), []);
  return (
    <>
      <Branding />
      <MaintenanceBanner />
      <Outlet />
      {env.authProvider === 'dev' && <DevRoleSwitcher />}
    </>
  );
}
