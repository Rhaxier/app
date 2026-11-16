// The choices for "Is it about a lift, stairs or a door?" on the report form.
// Lifts and stairs that serve the room's floor, then the room's own doors (only
// rooms from the traced map know their doors). If the form was opened from a
// lift on the map, that lift is always in the list, even if the floor isn't
// known. Out-of-order ones say so, so nobody reports what staff already know.
import type { Connector, Door } from '@/features/map/nav/types';

export type TargetOption = { value: string; label: string };

export function mapTargetOptions(
  connectors: Connector[],
  floor: string | null,
  doors: Pick<Door, 'id' | 'b'>[],
  selected: string,
): TargetOption[] {
  const onFloor = connectors.filter(
    (c) => floor === null || c.floors.includes(floor) || `connector:${c.id}` === selected,
  );
  const options: TargetOption[] = onFloor
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((c) => ({
      value: `connector:${c.id}`,
      label: `${c.name}${c.available ? '' : ' (marked out of order)'}`,
    }));
  doors.forEach((door, index) =>
    options.push({
      value: `door:${door.id}`,
      label: `${door.b === 'outside' ? 'Outside door' : 'Door'} ${index + 1} of this room (${door.id})`,
    }),
  );
  return options;
}
