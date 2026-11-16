// The stairs and lifts editor (Map and rooms > Stairs and lifts).
//
// Leaflet can't draw in the test browser, so the map is replaced by a stub
// with a "click the plan here" button, and the markers by plain buttons.
// Everything else is real: the draft, the checks on the traced map, the
// draft router behind "Try a route", Save, and the leave-page guard. The
// database calls are fakes. Connectors here are fixtures; nothing is saved.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import geometryJson from '@/features/map/nav/data/geometry.json';
import bundledCsv from '@/features/map/nav/data/assignments.csv?raw';
import { parseAssignmentsCsv } from '@/features/map/nav/assignments';
import { NavRouterContext, type NavRouterValue } from '@/features/map/nav/routerContext';
import type { Connector, Geometry, Point } from '@/features/map/nav/types';

const geometry = geometryJson as unknown as Geometry;
const liftSpot = { x: 1569, y: 1169 };
const clickAt = vi.hoisted(() => ({ point: { x: 1569, y: 1169 } as Point }));

vi.mock('@/features/map/nav/components/FloorPlanView', () => ({
  FloorPlanView: ({
    onMapClick,
    children,
  }: {
    onMapClick?: (p: Point) => void;
    children?: ReactNode;
  }) => (
    <div>
      <button type="button" onClick={() => onMapClick?.(clickAt.point)}>
        Click the plan here
      </button>
      {children}
    </div>
  ),
}));
vi.mock('@/features/map/nav/components/ConnectorMarkers', () => ({
  ConnectorMarkers: ({
    connectors,
    onSelect,
  }: {
    connectors: Connector[];
    onSelect: (id: string) => void;
  }) => (
    <>
      {connectors.map((c) => (
        <button key={c.id} type="button" onClick={() => onSelect(c.id)}>
          Marker {c.name}
        </button>
      ))}
    </>
  ),
}));

const fakeMutation = () => ({
  mutate: vi.fn((_input: unknown, options?: { onSuccess?: () => void }) => options?.onSuccess?.()),
  isPending: false,
  isError: false,
  error: null,
});
const hooks = vi.hoisted(() => ({ useSaveConnectors: vi.fn(), useSetAvailable: vi.fn() }));
vi.mock('@/features/map/nav/hooks', () => hooks);

import { ConnectorsTab } from './components/map-rooms/connectors/ConnectorsTab';

const assignments = parseAssignmentsCsv(bundledCsv).assignments;
const lift: Connector = {
  id: '00000000-0000-4000-8000-000000000001',
  type: 'lift',
  name: 'Test lift',
  floors: ['G', '1', '2', '3'],
  positions: { G: liftSpot, 1: liftSpot, 2: liftSpot, 3: liftSpot },
  accessible: true,
  available: true,
};

function renderEditor(saved: Connector[]) {
  const value: NavRouterValue = {
    router: null,
    version: 1,
    ready: true,
    error: null,
    geometry,
    connectors: saved,
    overrides: { doorAvailable: {}, edgeTags: {} },
    assignments,
    activePresetId: null,
  };
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <NavRouterContext.Provider value={value}>
            <Link to="/elsewhere">Elsewhere</Link>
            <ConnectorsTab />
          </NavRouterContext.Provider>
        ),
      },
      { path: '/elsewhere', element: <p>Somewhere else</p> },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
}

let save: ReturnType<typeof fakeMutation>;
let available: ReturnType<typeof fakeMutation>;

beforeEach(() => {
  save = fakeMutation();
  available = fakeMutation();
  hooks.useSaveConnectors.mockReturnValue(save);
  hooks.useSetAvailable.mockReturnValue(available);
  clickAt.point = liftSpot;
});

async function tryRoute(from: string, to: string) {
  const box = screen.getByRole('region', { name: 'Try a route' });
  await userEvent.selectOptions(within(box).getByLabelText('From'), from);
  await userEvent.selectOptions(within(box).getByLabelText('To'), to);
  return box;
}

describe('stairs and lifts editor', () => {
  it('with nothing placed: says so, and a route between floors gives the router’s message', async () => {
    renderEditor([]);
    expect(
      screen.getByText('No floors are connected yet: add stairs or a lift.'),
    ).toBeInTheDocument();
    const box = await tryRoute('G-R030', '3-R043');
    expect(
      within(box).getByText(
        "These floors aren't connected yet: an admin needs to add stairs or a lift.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
  });

  it('places a lift, connects every floor, routes on the unsaved draft, then saves the whole list', async () => {
    renderEditor([]);
    await userEvent.click(screen.getByRole('button', { name: 'Add lift' }));
    await userEvent.click(screen.getByRole('button', { name: 'Click the plan here' }));

    const panel = screen.getByRole('dialog');
    expect(within(panel).getByLabelText('Name')).toHaveValue('Lift 1');
    for (const floor of ['Floor 1', 'Floor 2', 'Floor 3']) {
      await userEvent.click(within(panel).getByLabelText(floor));
    }
    await userEvent.click(within(panel).getByRole('button', { name: /close/i }));

    expect(screen.getByText('All four floors are connected.')).toBeInTheDocument();
    const box = await tryRoute('G-R030', '3-R043');
    expect(within(box).getByText(/via Lift 1$/)).toBeInTheDocument();
    expect(within(box).getByText('Take the lift up to Third Floor')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(save.mutate).toHaveBeenCalledTimes(1);
    const sent = save.mutate.mock.calls[0][0] as Connector[];
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: 'lift', name: 'Lift 1', floors: ['G', '1', '2', '3'] });
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
  });

  it('won’t save a marker that isn’t on anything walkable', async () => {
    renderEditor([]);
    clickAt.point = { x: 5, y: 5 };
    await userEvent.click(screen.getByRole('button', { name: 'Add stairs' }));
    await userEvent.click(screen.getByRole('button', { name: 'Click the plan here' }));
    expect(
      screen.getByText('Stairs "Stairs 1" on floor G is outside any walkable area.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('marks a saved lift out of order at once, without leaving unsaved changes', async () => {
    renderEditor([lift]);
    await userEvent.click(screen.getByRole('button', { name: 'Marker Test lift' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('switch', { name: /Available/ }),
    );
    expect(available.mutate).toHaveBeenCalledTimes(1);
    expect(available.mutate.mock.calls[0][0]).toEqual({
      kind: 'connector',
      id: lift.id,
      available: false,
    });
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
  });

  it('asks before deleting, and deleting only changes the draft', async () => {
    renderEditor([lift]);
    await userEvent.click(screen.getByRole('button', { name: 'Marker Test lift' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }),
    );
    const confirm = screen.getByRole('dialog', { name: 'Delete Test lift?' });
    expect(confirm).toHaveTextContent(
      'Routes that use it will change, and floors may stop being connected.',
    );
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('button', { name: 'Marker Test lift' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Unsaved changes' })).toBeInTheDocument();
    expect(save.mutate).not.toHaveBeenCalled();
  });

  it('asks before leaving the page with unsaved changes', async () => {
    renderEditor([]);
    await userEvent.click(screen.getByRole('button', { name: 'Add lift' }));
    await userEvent.click(screen.getByRole('button', { name: 'Click the plan here' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /close/i }),
    );
    await userEvent.click(screen.getByRole('link', { name: 'Elsewhere' }));
    expect(screen.getByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument();
    expect(screen.queryByText('Somewhere else')).not.toBeInTheDocument();
  });
});
