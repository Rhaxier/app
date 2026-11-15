// One indoor router for every map screen below this provider.
//
// Why one shared router: building it indexes the whole geometry, which is
// too slow to repeat on every render. So it is created once per geometry,
// and when stairs, lifts, flags or room names change (an admin's save, or a
// Realtime update from another device) it is updated in place with
// setConnectors / setOverrides / setNames, which take a few milliseconds.
// `version` then goes up so screens showing a route work it out again.
//
// Wrap only the map screens in it: the geometry file is loaded the first
// time a provider mounts, and stays out of the rest of the app's download.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  useActiveAssignments,
  useConnectors,
  useGeometry,
  useMapRealtime,
  useOverrides,
} from './hooks.ts';
import { createRouter } from './router.ts';
import { NavRouterContext, type NavRouterValue } from './routerContext.ts';
import type { Connector, MapOverrides } from './types.ts';

// What the router has been given so far. `ready` compares these with the
// loaded data, so it only turns true after the router really has it (the
// effects that hand data over run after the render that loaded it).
type Applied = {
  connectors?: Connector[];
  overrides?: MapOverrides;
  names?: Record<string, string>;
  version: number;
};

export function NavRouterProvider({ children }: { children: ReactNode }) {
  const geometry = useGeometry();
  const connectors = useConnectors();
  const overrides = useOverrides();
  const assignments = useActiveAssignments();
  useMapRealtime();

  // Created once per geometry, with no stairs, flags or names yet: the
  // effects below add them as they load.
  const router = useMemo(
    () => (geometry.data ? createRouter(geometry.data) : null),
    [geometry.data],
  );
  const [applied, setApplied] = useState<Applied>({ version: 0 });

  // Display names by room id, for the step text ("Walk to PYP3 B").
  const names = useMemo(() => {
    if (!assignments.data) return undefined;
    const byId: Record<string, string> = {};
    for (const assignment of assignments.data.assignments) {
      if (assignment.name.trim() !== '') byId[assignment.roomId] = assignment.name;
    }
    return byId;
  }, [assignments.data]);

  useEffect(() => {
    if (router && connectors.data) {
      router.setConnectors(connectors.data);
      const list = connectors.data;
      setApplied((now) => ({ ...now, connectors: list, version: now.version + 1 }));
    }
  }, [router, connectors.data]);

  useEffect(() => {
    if (router && overrides.data) {
      router.setOverrides(overrides.data);
      const flags = overrides.data;
      setApplied((now) => ({ ...now, overrides: flags, version: now.version + 1 }));
    }
  }, [router, overrides.data]);

  useEffect(() => {
    if (router && names) {
      router.setNames(names);
      setApplied((now) => ({ ...now, names, version: now.version + 1 }));
    }
  }, [router, names]);

  const ready =
    router !== null &&
    connectors.data !== undefined &&
    applied.connectors === connectors.data &&
    overrides.data !== undefined &&
    applied.overrides === overrides.data &&
    names !== undefined &&
    applied.names === names;

  const value = useMemo<NavRouterValue>(
    () => ({
      router,
      version: applied.version,
      ready,
      error: geometry.error ?? connectors.error ?? overrides.error ?? assignments.error ?? null,
      geometry: geometry.data,
      connectors: connectors.data ?? [],
      overrides: overrides.data,
      assignments: assignments.data?.assignments ?? [],
      activePresetId: assignments.data?.presetId ?? null,
    }),
    [
      router,
      applied.version,
      ready,
      geometry.data,
      geometry.error,
      connectors.data,
      connectors.error,
      overrides.data,
      overrides.error,
      assignments.data,
      assignments.error,
    ],
  );

  return <NavRouterContext.Provider value={value}>{children}</NavRouterContext.Provider>;
}
