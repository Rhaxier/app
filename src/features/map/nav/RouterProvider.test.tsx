// The shared router: built once, then updated in place when stairs, flags or
// room names change, including changes that arrive through Realtime.
// The Supabase calls are replaced by fakes; the router by a spy, so the test
// can count how often it is built and what it is given.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connector } from './types.ts';

const api = vi.hoisted(() => ({
  fetchConnectors: vi.fn(),
  fetchOverrides: vi.fn(),
  fetchActivePresetId: vi.fn(),
  fetchAssignments: vi.fn(),
  subscribeToMapChanges: vi.fn(),
}));
vi.mock('./api.ts', () => api);

const fakeRouter = vi.hoisted(() => ({
  route: vi.fn(),
  setConnectors: vi.fn(),
  setOverrides: vi.fn(),
  setNames: vi.fn(),
  problems: vi.fn(() => []),
  graph: vi.fn(),
}));
const createRouter = vi.hoisted(() => vi.fn(() => fakeRouter));
vi.mock('./router.ts', () => ({ createRouter }));

import { NavRouterProvider } from './RouterProvider.tsx';
import { useNavRouter } from './routerContext.ts';

const lift = (id: string, available = true): Connector => ({
  id,
  type: 'lift',
  name: `Lift ${id}`,
  floors: ['G', '1'],
  positions: { G: { x: 1569, y: 1190 }, 1: { x: 1569, y: 1190 } },
  accessible: true,
  available,
});

function Probe() {
  const { ready, version, activePresetId } = useNavRouter();
  return (
    <p>
      {ready ? 'ready' : 'loading'} v{version} preset:{activePresetId ?? 'none'}
    </p>
  );
}

function renderProvider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NavRouterProvider>
        <Probe />
      </NavRouterProvider>
    </QueryClientProvider>,
  );
}

let realtimeChange: () => void = () => {};

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchConnectors.mockResolvedValue([lift('A')]);
  api.fetchOverrides.mockResolvedValue({ doorAvailable: {}, edgeTags: {} });
  api.fetchActivePresetId.mockResolvedValue(null);
  api.fetchAssignments.mockResolvedValue([]);
  api.subscribeToMapChanges.mockImplementation((onChange: () => void) => {
    realtimeChange = onChange;
    return () => {};
  });
});

describe('NavRouterProvider', () => {
  it('builds the router once and gives it the stairs, flags and names', async () => {
    renderProvider();
    await screen.findByText(/^ready/);
    expect(createRouter).toHaveBeenCalledTimes(1);
    expect(fakeRouter.setConnectors).toHaveBeenLastCalledWith([lift('A')]);
    expect(fakeRouter.setOverrides).toHaveBeenLastCalledWith({ doorAvailable: {}, edgeTags: {} });
  });

  it('uses the bundled room names until a term is made active', async () => {
    renderProvider();
    await screen.findByText(/preset:none/);
    await screen.findByText(/^ready/);
    const names = fakeRouter.setNames.mock.lastCall?.[0] as Record<string, string>;
    expect(names['G-R008']).toBe('Design and Technology Lab');
    expect(api.fetchAssignments).not.toHaveBeenCalled();
  });

  it('uses the active term once there is one', async () => {
    api.fetchActivePresetId.mockResolvedValue('term-2');
    api.fetchAssignments.mockResolvedValue([
      { roomId: 'G-R030', name: 'Grade 3 B', subject: '', teacher: '', type: 'classroom' },
    ]);
    renderProvider();
    await screen.findByText(/preset:term-2/);
    await waitFor(() =>
      expect(fakeRouter.setNames).toHaveBeenLastCalledWith({ 'G-R030': 'Grade 3 B' }),
    );
    expect(api.fetchAssignments).toHaveBeenCalledWith('term-2');
  });

  it('updates the same router when a Realtime change arrives (a lift goes out of order)', async () => {
    renderProvider();
    const before = await screen.findByText(/^ready/);
    const versionBefore = Number(/v(\d+)/.exec(before.textContent ?? '')?.[1]);

    api.fetchConnectors.mockResolvedValue([lift('A', false)]);
    await act(async () => realtimeChange());

    await waitFor(() =>
      expect(fakeRouter.setConnectors).toHaveBeenLastCalledWith([lift('A', false)]),
    );
    await waitFor(() => {
      const now = Number(/v(\d+)/.exec(screen.getByText(/^ready/).textContent ?? '')?.[1]);
      expect(now).toBeGreaterThan(versionBefore);
    });
    expect(createRouter).toHaveBeenCalledTimes(1);
  });
});
