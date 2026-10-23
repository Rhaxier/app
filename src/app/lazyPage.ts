// Route helper: a screen whose code downloads the first time someone opens it.
//   { path: '/map', lazy: lazyPage(() => import('@/features/map/pages/MapPage'), 'MapPage') }
// loads that file, then shows its exported MapPage component.
import type { ComponentType } from 'react';

export function lazyPage<M extends Record<string, unknown>>(
  load: () => Promise<M>,
  name: keyof M & string,
) {
  return async () => ({ Component: (await load())[name] as ComponentType });
}
