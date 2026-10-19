// Wraps every route, signed in or not. Its only job: show the dev role
// switcher in dev mode, including on the sign-in screen.
import { Outlet } from 'react-router-dom';
import { env } from '@/lib/env';
import { DevRoleSwitcher } from './DevRoleSwitcher';

export function RootLayout() {
  return (
    <>
      <Outlet />
      {env.authProvider === 'dev' && <DevRoleSwitcher />}
    </>
  );
}
