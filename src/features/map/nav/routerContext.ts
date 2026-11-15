// The shared indoor router, handed to map screens by <NavRouterProvider>.
// Kept apart from the provider component so React's fast refresh works
// (a file should export components only, or no components).
import { createContext, useContext } from 'react';
import type { Router } from './router.ts';
import type { Assignment, Connector, Geometry, MapOverrides } from './types.ts';

export type NavRouterValue = {
  /** Null until the geometry has loaded. */
  router: Router | null;
  /**
   * Goes up by one every time the router's stairs, flags or names change.
   * A screen showing a route puts it in its effect or memo dependencies, so
   * the route is worked out again (a lift marked out of order, a new term).
   */
  version: number;
  /** True once geometry, stairs and lifts, flags and names have all loaded. */
  ready: boolean;
  /** The first loading error, if any (shown with the error state). */
  error: Error | null;
  geometry: Geometry | undefined;
  connectors: Connector[];
  overrides: MapOverrides | undefined;
  assignments: Assignment[];
  /** Null while students see the bundled names (no term made active yet). */
  activePresetId: string | null;
};

export const NavRouterContext = createContext<NavRouterValue | null>(null);

export function useNavRouter(): NavRouterValue {
  const value = useContext(NavRouterContext);
  if (value === null) {
    throw new Error('useNavRouter must be used inside <NavRouterProvider>.');
  }
  return value;
}
