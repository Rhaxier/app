// The indoor map screen: picking the two ends, the step-free switch, swap,
// the "I'm here" pin, the router's messages, and moving between floors with
// the steps and the floor-change chip.
//
// Leaflet can't draw in the test browser, so the plan, the route line and the
// pins are stubs: the plan stub has buttons for "tap the map here" and "tap a
// room", and shows which floor is in view. Routing is real (traced map, a
// fixture lift) except where a fake router stands in for an error.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import bundledCsv from './nav/data/assignments.csv?raw';
import geometryJson from './nav/data/geometry.json';
import { parseAssignmentsCsv } from './nav/assignments';
import { createRouter, ROUTE_MESSAGES, type Router, type RouteResult } from './nav/router';
import { NavRouterContext, type NavRouterValue } from './nav/routerContext';
import type { Connector, Geometry, Point } from './nav/types';

const tap = vi.hoisted(() => ({ point: { x: 1569, y: 1169 } as Point, room: '3-R043' }));
const role = vi.hoisted(() => ({ value: 'student' }));

vi.mock('./nav/components/FloorPlanView', () => ({
  FloorPlanView: (props: {
    floor: string;
    onMapClick?: (p: Point) => void;
    onSelect?: (id: string) => void;
    children?: ReactNode;
  }) => (
    <div>
      <p data-testid="floor">{props.floor}</p>
      {props.onMapClick && (
        <button type="button" onClick={() => props.onMapClick?.(tap.point)}>
          Tap the map here
        </button>
      )}
      {props.onSelect && (
        <button type="button" onClick={() => props.onSelect?.(tap.room)}>
          Tap a room
        </button>
      )}
      {props.children}
    </div>
  ),
}));
vi.mock('./nav/components/RouteLayer', async () => {
  const view = await import('./nav/routeView');
  return {
    RouteLayer: (props: {
      result: Parameters<typeof view.floorChanges>[0];
      floor: string;
      onShowFloor: (f: string) => void;
    }) => (
      <>
        {view
          .floorChanges(props.result)
          .filter((c) => c.fromFloor === props.floor)
          .map((c) => (
            <button key={c.text} type="button" onClick={() => props.onShowFloor(c.toFloor)}>
              {c.text}
            </button>
          ))}
      </>
    ),
  };
});
vi.mock('./nav/components/NavPins', () => ({
  ConnectorPin: () => null,
  HereMarker: () => <p>Pin</p>,
  ReportCountPin: () => null,
  BusyDot: () => null,
}));
vi.mock('@/features/auth/hooks', () => ({
  useCurrentUser: () => ({ role: role.value, responsibilities: [] }),
}));
vi.mock('@/features/fixit/hooks', () => ({
  useReports: () => ({ data: [] }),
  useLiveReports: () => {},
}));
vi.mock('@/features/venues/hooks', () => ({
  useVenues: () => ({ data: [] }),
  useBookingsNow: () => ({ data: [] }),
  useLiveBookings: () => {},
}));
vi.mock('./nav/hooks', () => ({
  useTracedRooms: () => ({ data: {} }),
  useCanMarkOutOfOrder: () => ({ data: false }),
  useSetAvailable: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}));
const toasts = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock('@/lib/toast', () => toasts);

import { MapScreen } from './pages/IndoorMapPage';

const geometry = geometryJson as unknown as Geometry;
const assignments = parseAssignmentsCsv(bundledCsv).assignments;
const liftSpot = { x: 1569, y: 1169 };
const lift: Connector = {
  id: 'fixture-lift',
  type: 'lift',
  name: 'Fixture lift',
  floors: ['G', '1', '2', '3'],
  positions: { G: liftSpot, 1: liftSpot, 2: liftSpot, 3: liftSpot },
  accessible: true,
  available: true,
};

function renderMap(router: Router, url = '/') {
  const value: NavRouterValue = {
    router,
    version: 1,
    ready: true,
    error: null,
    geometry,
    connectors: [],
    overrides: { doorAvailable: {}, edgeTags: {} },
    assignments,
    activePresetId: null,
  };
  return render(
    <MemoryRouter initialEntries={[url]}>
      <NavRouterContext.Provider value={value}>
        <MapScreen geometry={geometry} router={router} />
      </NavRouterContext.Provider>
    </MemoryRouter>,
  );
}

function fakeRouter(result: RouteResult): Router & { route: ReturnType<typeof vi.fn> } {
  return {
    route: vi.fn(() => result),
    setConnectors: vi.fn(),
    setOverrides: vi.fn(),
    setNames: vi.fn(),
    problems: vi.fn(() => []),
    graph: vi.fn(),
  } as unknown as Router & { route: ReturnType<typeof vi.fn> };
}

const panel = () => screen.getByRole('region', { name: 'Directions' });
const floorShown = () => screen.getByTestId('floor').textContent;
// A route shrinks the panel to time, distance and the current step.
const expand = () =>
  userEvent.click(within(panel()).getByRole('button', { name: 'Show all directions' }));

beforeEach(() => {
  role.value = 'student';
  tap.point = liftSpot;
  tap.room = '3-R043';
  window.localStorage.clear();
});

describe('indoor map: a route between floors (real router, fixture lift)', () => {
  it('picks where to and where from by searching, and shows the route', async () => {
    renderMap(createRouter(geometry, [lift]));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Where to?' }), '12 B');
    await userEvent.click(screen.getByRole('button', { name: /^12 B/ }));
    await userEvent.type(
      within(panel()).getByRole('searchbox', { name: "Or the room you're nearest" }),
      'PYP3 B',
    );
    await userEvent.click(within(panel()).getByRole('button', { name: /^PYP3 B/ }));

    expect(within(panel()).getByText(/about \d+ min|under a minute/)).toBeInTheDocument();
    expect(within(panel()).getByText(/Step 1 of \d+/)).toBeInTheDocument();
    expect(floorShown()).toBe('G');
  });

  it('closes the search matches with Escape', async () => {
    renderMap(createRouter(geometry, [lift]));
    const search = screen.getByRole('searchbox', { name: 'Where to?' });
    await userEvent.type(search, '12 B');
    expect(screen.getByRole('button', { name: /^12 B/ })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: /^12 B/ })).not.toBeInTheDocument();
    expect(search).toHaveValue('');
  });

  it('switches floor from the floor-change chip, and from the steps', async () => {
    renderMap(createRouter(geometry, [lift]), '/?from=G-R030&to=3-R043');
    expect(floorShown()).toBe('G');
    // The chip on the map (the same words are also a step in the panel's list).
    const chip = screen
      .getAllByRole('button', { name: 'Take the lift up to Third Floor' })
      .find((button) => !panel().contains(button));
    await userEvent.click(chip as HTMLElement);
    expect(floorShown()).toBe('3');

    // The last step ("Your destination, 12 B, ...") is on the third floor;
    // the first is back on the ground floor.
    await expand();
    const steps = within(panel())
      .getAllByRole('button', { name: /./ })
      .filter((b) => b.closest('ol'));
    await userEvent.click(steps[steps.length - 1]);
    expect(floorShown()).toBe('3');
    await userEvent.click(within(panel()).getByRole('button', { name: 'Previous' }));
    await userEvent.click(steps[0]);
    expect(floorShown()).toBe('G');
    await userEvent.click(within(panel()).getByRole('button', { name: 'Next' }));
    expect(within(panel()).getByText(/Step 2 of/)).toBeInTheDocument();
  });

  it('starts from a pin dropped on the floor in view (the destination floor), snapped', async () => {
    renderMap(createRouter(geometry, [lift]), '/?to=3-R043');
    await userEvent.click(within(panel()).getByRole('button', { name: 'Drop a pin on the map' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tap the map here' }));
    await expand();
    expect(within(panel()).getByText(/Your pin, floor 3/)).toBeInTheDocument();
    expect(within(panel()).getByText(/Step 1 of/)).toBeInTheDocument();
  });

  it('refuses a pin outside the building with the router’s message', async () => {
    tap.point = { x: 5, y: 5 };
    renderMap(createRouter(geometry, [lift]), '/?to=3-R043');
    await userEvent.click(within(panel()).getByRole('button', { name: 'Drop a pin on the map' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tap the map here' }));
    expect(within(panel()).getByRole('alert')).toHaveTextContent(
      ROUTE_MESSAGES['start-not-walkable'],
    );
  });

  it('tapping a room on the plan makes it the destination', async () => {
    renderMap(createRouter(geometry, [lift]));
    await userEvent.click(screen.getByRole('button', { name: 'Tap a room' }));
    expect(within(panel()).getByText('12 B')).toBeInTheDocument();
  });
});

describe('indoor map: mode, swap and messages (fake router)', () => {
  const ok: RouteResult = {
    ok: true,
    mode: 'standard',
    distanceM: 40,
    durationS: 40,
    legs: [{ floor: 'G', points: [liftSpot, { x: 1600, y: 1169 }] }],
    steps: [
      { kind: 'start', text: 'Leave PYP3 B', floor: 'G', distanceM: 0, durationS: 0 },
      { kind: 'arrive', text: 'Your destination, Art', floor: 'G', distanceM: 40, durationS: 40 },
    ],
    connectors: [],
  };

  it('shrinks to time, distance and the current step once there is a route, and grows back', async () => {
    renderMap(fakeRouter(ok), '/?from=G-R030&to=G-R008');
    expect(within(panel()).getByText('under a minute')).toBeInTheDocument();
    expect(within(panel()).getByText(/Step 1 of 2/)).toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(within(panel()).queryByRole('switch')).not.toBeInTheDocument();

    await expand();
    expect(within(panel()).getByRole('switch', { name: /Step-free route/ })).toBeInTheDocument();
    await userEvent.click(within(panel()).getByRole('button', { name: 'Show less' }));
    expect(within(panel()).queryByRole('switch')).not.toBeInTheDocument();
  });

  it('asks for a step-free route when the switch is on, and remembers it', async () => {
    const router = fakeRouter(ok);
    renderMap(router, '/?from=G-R030&to=G-R008');
    expect(router.route.mock.lastCall?.[2]).toEqual({ mode: 'standard' });
    await expand();
    await userEvent.click(within(panel()).getByRole('switch', { name: /Step-free route/ }));
    expect(router.route.mock.lastCall?.[2]).toEqual({ mode: 'step-free' });
    expect(window.localStorage.getItem('campus.map.stepFree')).toBe('true');
  });

  it('swaps the start and the destination', async () => {
    const router = fakeRouter(ok);
    renderMap(router, '/?from=G-R030&to=G-R008');
    await expand();
    await userEvent.click(
      within(panel()).getByRole('button', { name: 'Swap start and destination' }),
    );
    expect(router.route.mock.lastCall?.slice(0, 2)).toEqual([
      { type: 'room', id: 'G-R008' },
      { type: 'room', id: 'G-R030' },
    ]);
  });

  it('says when floors aren’t connected, and shows admins where to fix it', async () => {
    const notConnected: RouteResult = {
      ok: false,
      code: 'floors-not-connected',
      message: ROUTE_MESSAGES['floors-not-connected'],
    };
    renderMap(fakeRouter(notConnected), '/?from=G-R030&to=3-R043');
    expect(within(panel()).getByText(ROUTE_MESSAGES['floors-not-connected'])).toBeInTheDocument();
    expect(
      within(panel()).queryByRole('link', { name: 'Add stairs or a lift' }),
    ).not.toBeInTheDocument();
  });

  it('gives admins the link to the stairs and lifts editor', async () => {
    role.value = 'admin';
    renderMap(
      fakeRouter({
        ok: false,
        code: 'floors-not-connected',
        message: ROUTE_MESSAGES['floors-not-connected'],
      }),
      '/?from=G-R030&to=3-R043',
    );
    expect(within(panel()).getByRole('link', { name: 'Add stairs or a lift' })).toHaveAttribute(
      'href',
      '/admin/map-rooms?tab=connectors',
    );
  });

  it('offers the route with stairs when there is no step-free one', async () => {
    window.localStorage.setItem('campus.map.stepFree', 'true');
    const router = fakeRouter({
      ok: false,
      code: 'no-step-free-route',
      message: ROUTE_MESSAGES['no-step-free-route'],
    });
    renderMap(router, '/?from=G-R030&to=3-R043');
    expect(within(panel()).getByText(ROUTE_MESSAGES['no-step-free-route'])).toBeInTheDocument();
    await userEvent.click(within(panel()).getByRole('button', { name: 'Show route with stairs' }));
    expect(router.route.mock.lastCall?.[2]).toEqual({ mode: 'standard' });
  });

  it('shows the other errors in the router’s words', () => {
    for (const code of ['blocked', 'unreachable'] as const) {
      const router = fakeRouter({ ok: false, code, message: ROUTE_MESSAGES[code] });
      const view = renderMap(router, '/?from=G-R030&to=3-R043');
      expect(screen.getByText(ROUTE_MESSAGES[code])).toBeInTheDocument();
      view.unmount();
    }
  });
});

describe('indoor map: out of order (real router)', () => {
  const stairsSpot = { x: 1221, y: 978 };
  const stairs: Connector = {
    id: 'fixture-stairs',
    type: 'stairs',
    name: 'West stairs',
    floors: ['G', '1', '2', '3'],
    positions: { G: stairsSpot, 1: stairsSpot, 2: stairsSpot, 3: stairsSpot },
    accessible: false,
    available: true,
  };

  function screenWith(router: Router, connectors: Connector[], version: number) {
    const value: NavRouterValue = {
      router,
      version,
      ready: true,
      error: null,
      geometry,
      connectors,
      overrides: { doorAvailable: {}, edgeTags: {} },
      assignments,
      activePresetId: null,
    };
    return (
      <MemoryRouter initialEntries={['/?from=G-R030&to=3-R043']}>
        <NavRouterContext.Provider value={value}>
          <MapScreen geometry={geometry} router={router} />
        </NavRouterContext.Provider>
      </MemoryRouter>
    );
  }

  it('reroutes an open route when the stairs go out of order, and says why', () => {
    toasts.showToast.mockReset();
    const router = createRouter(geometry, [lift, stairs]);
    const view = render(screenWith(router, [lift, stairs], 1));
    expect(within(panel()).queryByText(/out of order/)).not.toBeInTheDocument();

    // A Realtime update: the stairs are marked out of order elsewhere.
    const now = [lift, { ...stairs, available: false }];
    router.setConnectors(now);
    view.rerender(screenWith(router, now, 2));

    expect(
      within(panel()).getByText('West stairs is out of order, so this route goes another way.'),
    ).toBeInTheDocument();
    expect(toasts.showToast).toHaveBeenCalledWith('West stairs is out of order. Route updated.');
  });

  it('explains why there is no step-free route when the lift is out of order', () => {
    window.localStorage.setItem('campus.map.stepFree', 'true');
    const now = [{ ...lift, available: false }, stairs];
    render(screenWith(createRouter(geometry, now), now, 1));
    expect(within(panel()).getByText(ROUTE_MESSAGES['no-step-free-route'])).toBeInTheDocument();
    expect(
      within(panel()).getByText('No step-free route right now: Fixture lift is out of order.'),
    ).toBeInTheDocument();
  });
});
