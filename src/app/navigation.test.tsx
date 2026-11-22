// The right navigation for each kind of screen (src/lib/layout.ts): the
// bottom tab bar on phones (also when turned sideways), the icon rail on
// tablets, the sidebar with labels on laptops, and the rail again on the map
// and the admin dashboard, which need the width.
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/features/auth/api';
import { createQueryClient } from '@/lib/queryClient';
import { resetScreenSize, setScreenSize } from '@/test/media';
import { makeUser, teacher } from '@/test/utils';
import { AppLayout } from './AppLayout';

let signedIn: CurrentUser = makeUser();
vi.mock('@/features/auth/hooks', () => ({ useCurrentUser: () => signedIn }));
// No live connection in tests: two unread notifications, no Realtime, no push.
vi.mock('@/features/notifications/hooks', () => ({
  useUnreadCount: () => ({ data: 2 }),
  useLiveNotifications: () => {},
}));
vi.mock('@/features/notifications/push', () => ({ registerForPush: () => Promise.resolve() }));
vi.mock('@/features/settings/hooks', () => ({ useFeatureVisible: () => () => true }));

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ element: <AppLayout />, children: [{ path: '*', element: <p>The screen</p> }] }],
    { initialEntries: [path] },
  );
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

/** The one "Main" navigation, and which kind it is. */
function mainNav() {
  const nav = screen.getByRole('navigation', { name: 'Main' });
  const kind = nav.querySelector('[class*="tabglass"]') ? 'bar' : 'side';
  return { nav, kind };
}

describe('Navigation by screen size', () => {
  beforeEach(() => {
    signedIn = makeUser();
    // The layout restores scroll positions; the test browser can't scroll.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    resetScreenSize();
    vi.restoreAllMocks();
    document.documentElement.removeAttribute('data-nav');
  });

  it('keeps the bottom tab bar on a phone', () => {
    setScreenSize(390, 844);
    renderAt('/');
    expect(mainNav().kind).toBe('bar');
    expect(document.documentElement.dataset.nav).toBeUndefined();
  });

  it('keeps the bottom tab bar on a phone turned sideways (wide but short)', () => {
    setScreenSize(932, 430);
    renderAt('/');
    expect(mainNav().kind).toBe('bar');
  });

  it('shows the icon rail on an iPad held upright, including iPad mini (744px)', () => {
    setScreenSize(744, 1133);
    renderAt('/');
    expect(mainNav().kind).toBe('side');
    expect(document.documentElement.dataset.nav).toBe('rail');
    // The rail has no "Search" text, but the button still has its name.
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('shows the sidebar with the same tabs, labelled, on a laptop', () => {
    setScreenSize(1280, 800);
    renderAt('/');
    expect(document.documentElement.dataset.nav).toBe('sidebar');
    const tabs = within(mainNav().nav).getByRole('list');
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Home', 'Map', 'Volunteer', 'Collab', 'Book']);
    // The search button shows its word and shortcut on a laptop.
    expect(screen.getByRole('button', { name: /Search/ })).toHaveTextContent('Search');
  });

  it('puts the bell (with the unread count) and Me in the side navigation', () => {
    setScreenSize(820, 1180);
    renderAt('/');
    const { nav } = mainNav();
    expect(within(nav).getByRole('link', { name: 'Notifications, 2 unread' })).toHaveAttribute(
      'href',
      '/notifications',
    );
    expect(within(nav).getByRole('link', { name: 'Me: Student Grade 10 A' })).toHaveAttribute(
      'href',
      '/me',
    );
  });

  it('lights up the bell, not Home, on the inbox', () => {
    setScreenSize(1280, 800);
    renderAt('/notifications');
    const { nav } = mainNav();
    expect(within(nav).getByRole('link', { name: /Notifications/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('adds Approvals for staff, and only for staff', () => {
    setScreenSize(1280, 800);
    renderAt('/');
    expect(screen.queryByRole('link', { name: 'Approvals' })).not.toBeInTheDocument();
  });

  it('shows Approvals to a teacher in the sidebar', () => {
    signedIn = teacher;
    setScreenSize(1280, 800);
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Approvals' })).toHaveAttribute('href', '/approvals');
  });

  it('uses the rail on the map, even on a laptop, so the plan gets the width', () => {
    setScreenSize(1280, 800);
    renderAt('/map');
    expect(document.documentElement.dataset.nav).toBe('rail');
  });

  it('keeps the sidebar on the report form under the map', () => {
    setScreenSize(1280, 800);
    renderAt('/map/report');
    expect(document.documentElement.dataset.nav).toBe('sidebar');
  });

  it('uses the rail on the admin dashboard, even on a laptop', () => {
    signedIn = makeUser({ role: 'admin' });
    setScreenSize(1280, 800);
    renderAt('/admin/users');
    expect(document.documentElement.dataset.nav).toBe('rail');
  });
});
