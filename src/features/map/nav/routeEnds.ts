// Turns a search result into what the router expects. Entrances are doors
// (`{ type: 'door' }`); rooms and wall-less places keep their own kind.
import type { Destination } from './assignments.ts';
import type { RouteEnd } from './router.ts';

export const destinationEnd = (destination: Destination): RouteEnd =>
  destination.kind === 'entrance'
    ? { type: 'door', id: destination.roomId }
    : { type: destination.kind, id: destination.roomId };
