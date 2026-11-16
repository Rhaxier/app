// The fix-it sheet over the map: its close button in the top right corner.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/queryClient';
import type { Report } from './api';
import { ReportCard } from './components/ReportCard';

// "Me too" needs a signed-in user; the close button doesn't care who it is.
vi.mock('@/features/auth/hooks', () => ({ useCurrentUser: () => ({ id: 'user-1' }) }));

const report = {
  id: 'report-1',
  room_id: 'room-1',
  room_code: 'G.15',
  category_name: 'IT',
  description: "Projector won't turn on",
  status: 'open',
  urgent: false,
  photo_path: null,
  created_at: '2026-11-16T05:00:00Z',
  routed_to: 'it',
  vote_count: 0,
  voted_by_me: false,
  reported_by_me: false,
} as unknown as Report;

function renderCard(onClose?: () => void) {
  render(
    <QueryClientProvider client={createQueryClient({ retry: false })}>
      <MemoryRouter>
        <ReportCard report={report} onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('the fix-it sheet on the map', () => {
  it('has a close button that closes it', async () => {
    const onClose = vi.fn();
    renderCard(onClose);
    await userEvent.click(screen.getByRole('button', { name: 'Close fix-it report' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has no close button where nothing can close it', () => {
    renderCard();
    expect(screen.queryByRole('button', { name: 'Close fix-it report' })).not.toBeInTheDocument();
  });
});
