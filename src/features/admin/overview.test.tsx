// Admin dashboard: the real admin routes turn non-admins away, and the
// overview shows the counts the database sends. (The database refuses
// non-admins the numbers anyway: supabase/tests/09_admin_overview_test.sql.)
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireRole } from '@/app/guards';
import type { CurrentUser } from '@/features/auth/api';
import { createQueryClient } from '@/lib/queryClient';
import { makeUser, renderWithProviders, teacher } from '@/test/utils';
import type { AttentionRow, Metrics } from './api';
import { percent, waitingFor } from './logic';
import { OverviewPage } from './pages/OverviewPage';
import { adminRoutes } from './routes';
import { adminGroups } from './sections';

let signedIn: CurrentUser = makeUser();
vi.mock('@/features/auth/hooks', () => ({ useCurrentUser: () => signedIn }));

const now = Date.now();
const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();

const attention: AttentionRow[] = [
  { kind: 'events_to_approve', item_count: 2, urgent_count: 0, oldest_at: daysAgo(3) },
  { kind: 'venue_requests', item_count: 3, urgent_count: 0, oldest_at: daysAgo(2) },
  { kind: 'bookings_awaiting_teacher', item_count: 1, urgent_count: 0, oldest_at: daysAgo(1) },
  { kind: 'hours_to_confirm', item_count: 0, urgent_count: 0, oldest_at: null },
  { kind: 'open_reports', item_count: 5, urgent_count: 2, oldest_at: daysAgo(6) },
  { kind: 'reported_content', item_count: 1, urgent_count: 0, oldest_at: daysAgo(1) },
  { kind: 'hidden_posts', item_count: 0, urgent_count: 0, oldest_at: null },
];

const metrics: Metrics[] = [7, 30].map((days) => ({
  days,
  active_users: days === 7 ? 41 : 120,
  new_reports: 5,
  resolved_reports: 2,
  avg_days_to_resolve: 1.5,
  bookings_requested: 9,
  bookings_held: 6,
  supw_hours_confirmed: 12.5,
  collab_posts_created: 4,
  collab_posts_filled: 1,
}));

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  fetchAttention: async () => attention,
  fetchMetrics: async () => metrics,
  fetchVenueUtilisation: async () => [
    {
      venue_id: 'v1',
      venue_name: 'Auditorium',
      booked_hours: 12,
      bookable_hours: 30,
      utilisation: 0.4,
    },
  ],
  fetchSupwByGrade: async () => [{ grade: 10, students: 3, hours: 7 }],
}));
vi.mock('@/features/fixit/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/fixit/api')>()),
  fetchOpenReports: async () => [],
}));

describe('admin routes', () => {
  function openAdmin(path: string) {
    const router = createMemoryRouter(
      [{ element: <RequireRole role="admin" />, children: [adminRoutes] }],
      { initialEntries: [path] },
    );
    render(
      <QueryClientProvider client={createQueryClient({ retry: false })}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  }

  it('are unreachable for students and teachers', async () => {
    for (const user of [makeUser(), teacher]) {
      signedIn = user;
      openAdmin('/admin/users');
      expect(await screen.findByText('Admins only')).toBeInTheDocument();
      document.body.innerHTML = '';
    }
  });

  it('include every section in the menu', () => {
    const routed = adminRoutes.children?.map((route) => route.path);
    for (const group of adminGroups) {
      for (const section of group.sections) expect(routed).toContain(section.path);
    }
  });

  it('open for admins', async () => {
    signedIn = makeUser({ role: 'admin', grade: null });
    openAdmin('/admin/overview');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });
});

describe('OverviewPage', () => {
  it('shows each "needs attention" count from the database', async () => {
    renderWithProviders(<OverviewPage />);
    // Pending approvals = venue requests + awaiting a teacher + hours (3 + 1 + 0).
    expect(await screen.findByRole('article', { name: 'Pending approvals: 4' })).toBeVisible();
    expect(screen.getByRole('article', { name: 'Open fix-it reports: 5' })).toHaveTextContent(
      '2 urgent · waiting 6 days',
    );
    expect(screen.getByRole('article', { name: 'Reported posts: 1' })).toBeVisible();
    expect(screen.getByRole('article', { name: 'Student events to approve: 2' })).toBeVisible();
  });

  it('shows the numbers for the chosen period, and the charts as text', async () => {
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByText('41')).toBeInTheDocument();
    // Each value is written at its bar's tip and again in the table view.
    expect(await screen.findAllByText('40% · 12 of 30 h')).toHaveLength(2);
    expect(await screen.findAllByText('7 h · 3 students')).toHaveLength(2);
  });
});

describe('overview wording', () => {
  it('says how long things have waited, and shares as percentages', () => {
    const from = new Date('2026-10-20T08:00:00Z');
    expect(waitingFor('2026-10-20T07:30:00Z', from)).toBe('waiting under an hour');
    expect(waitingFor('2026-10-19T08:00:00Z', from)).toBe('waiting 24 hours');
    expect(waitingFor('2026-10-16T08:00:00Z', from)).toBe('waiting 4 days');
    expect(percent(0.4236)).toBe('42%');
    expect(percent(null)).toBe('–');
  });
});
