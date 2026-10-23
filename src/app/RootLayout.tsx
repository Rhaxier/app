// Wraps every route, signed in or not: the school's branding, any maintenance
// notice, and (in dev mode) the dev role switcher, including on sign-in.
import { Outlet } from 'react-router-dom';
import { env } from '@/lib/env';
import { Branding, MaintenanceBanner } from './Branding';
import { DevRoleSwitcher } from './DevRoleSwitcher';

export function RootLayout() {
  return (
    <>
      <Branding />
      <MaintenanceBanner />
      <Outlet />
      {env.authProvider === 'dev' && <DevRoleSwitcher />}
    </>
  );
}
