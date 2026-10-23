// "Me too" is optimistic: the count changes the moment you tap. If the
// database refuses, the count goes back and a toast explains.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/queryClient';
import { dismissToast, getToasts } from '@/lib/toast';
import { makeUser, renderWithProviders } from '@/test/utils';
import { addVote, fetchReports, type Report } from './api';
import { MeTooButton } from './components/MeTooButton';
import { fixitKeys, useReports } from './hooks';
import { withVote } from './logic';

vi.mock('@/features/auth/hooks', () => ({ useCurrentUser: () => makeUser() }));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  addVote: vi.fn(),
  fetchReports: vi.fn(),
}));

const report = {
  id: 'r1',
  description: "Projector won't turn on",
  vote_count: 3,
  voted_by_me: false,
  reported_by_me: false,
} as Report;

// Shows the button the way the map card does: count from the cached list.
function Card() {
  const reports = useReports();
  const shown = reports.data?.[0];
  if (!shown) return null;
  return (
    <MeTooButton
      reportId={shown.id}
      count={shown.vote_count}
      votedByMe={shown.voted_by_me}
      reportedByMe={false}
    />
  );
}

describe('optimistic "me too"', () => {
  afterEach(() => {
    for (const toast of getToasts()) dismissToast(toast.id);
  });

  it('counts the vote at once, then rolls back with a toast when refused', async () => {
    let refuse!: (error: unknown) => void;
    vi.mocked(addVote).mockReturnValue(new Promise((_resolve, reject) => (refuse = reject)));
    // After the failure the hook refetches; the server still says 3.
    vi.mocked(fetchReports).mockResolvedValue([report]);
    const queryClient = createQueryClient({ retry: false });
    queryClient.setQueryData(fixitKeys.reports(), [report]);

    renderWithProviders(<Card />, { queryClient });
    await userEvent.click(screen.getByRole('button', { name: 'Me too · 3' }));

    // The server hasn't answered yet, but the screen already shows the vote.
    expect(await screen.findByRole('button', { name: 'You said me too · 4' })).toBeInTheDocument();

    refuse({ code: 'P0001', message: 'This report is already closed.' });

    expect(await screen.findByRole('button', { name: 'Me too · 3' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('toast-errors')).toHaveTextContent(
        'This report is already closed.',
      ),
    );
  });
});

describe('withVote', () => {
  it('changes one report in a list and leaves everything else alone', () => {
    const other = { ...report, id: 'r2' };
    expect(withVote([report, other], 'r1', true)).toEqual([
      { ...report, vote_count: 4, voted_by_me: true },
      other,
    ]);
    expect(withVote('a signed photo url', 'r1', true)).toBe('a signed photo url');
  });
});
