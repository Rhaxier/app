// Staff and admin screens politely refuse other people. (The database
// refuses them the data regardless; this is about what the screen shows.)
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/features/auth/api';
import { makeUser, renderWithProviders, teacher } from '@/test/utils';
import { RequireRole } from './guards';

let signedIn: CurrentUser = makeUser();
vi.mock('@/features/auth/hooks', () => ({ useCurrentUser: () => signedIn }));

function renderAt(path: string) {
  renderWithProviders(
    <Routes>
      <Route element={<RequireRole role="staff" />}>
        <Route path="/approvals" element={<p>Approvals queue</p>} />
      </Route>
      <Route element={<RequireRole role="admin" />}>
        <Route path="/admin" element={<p>Admin tools</p>} />
      </Route>
    </Routes>,
    { route: path },
  );
}

describe('RequireRole', () => {
  it('turns students away from staff screens', () => {
    signedIn = makeUser();
    renderAt('/approvals');
    expect(screen.getByText('Staff only')).toBeInTheDocument();
    expect(screen.queryByText('Approvals queue')).not.toBeInTheDocument();
  });

  it('lets teachers into staff screens but not admin ones', () => {
    signedIn = teacher;
    renderAt('/approvals');
    expect(screen.getByText('Approvals queue')).toBeInTheDocument();
  });

  it('keeps admin screens for admins', () => {
    signedIn = teacher;
    renderAt('/admin');
    expect(screen.getByText('Admins only')).toBeInTheDocument();
  });

  it('lets admins in', () => {
    signedIn = makeUser({ role: 'admin' });
    renderAt('/admin');
    expect(screen.getByText('Admin tools')).toBeInTheDocument();
  });
});
