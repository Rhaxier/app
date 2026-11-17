// The stairs and lift markers in the editor, drawn inside <FloorPlanView>.
//
// What is drawn on the current floor:
//   * each connector that serves it, as a draggable marker (44px target),
//     with a thin line to the point on the corridor it attaches to;
//   * a red ring under a marker that isn't on anything walkable;
//   * dashed "ghost" circles where connectors sit on the floor just above
//     and just below, so a staircase can be lined up floor by floor;
//   * with an Add tool, a ghost of the new marker under the pointer.
//
// Why the warning ring is separate from the icon: changing a Leaflet
// marker's icon while it is being dragged cancels the drag. The icons change
// only with selection, availability or type; the ring follows the drag.
import L from 'leaflet';
import { Fragment, useMemo } from 'react';
import { CircleMarker, Marker, Polyline } from 'react-leaflet';
import { glyphSvg, LIFT_PATHS, STAIRS_PATHS } from '@/components/connectorGlyphs';
import { snapToWalkable, type GeometryIndex, type LinkResult } from '../graph.ts';
import type { Connector, ConnectorType, FloorId, Point } from '../types.ts';
import styles from './ConnectorMarkers.module.css';
import { fromLatLng, toLatLng } from './latlng.ts';

interface ConnectorMarkersProps {
  index: GeometryIndex;
  floor: FloorId;
  connectors: Connector[];
  link: LinkResult;
  selectedId: string | null;
  /** Markers can be dragged (the Select tool). */
  draggable: boolean;
  /** The connector being dragged and where it is now, or null. */
  dragging: { id: string; point: Point } | null;
  onSelect: (id: string) => void;
  onDrag: (id: string, point: Point) => void;
  onDrop: (id: string, point: Point) => void;
  /** The Add tool's ghost: the kind being added and the pointer position. */
  adding: { type: ConnectorType; point: Point | null } | null;
}

const iconCache = new Map<string, L.DivIcon>();

function markerIcon(type: ConnectorType, selected: boolean, available: boolean): L.DivIcon {
  const key = `${type}:${selected}:${available}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const classes = [
      styles.marker,
      selected && styles.selected,
      !available && styles.unavailable,
    ].filter(Boolean);
    icon = L.divIcon({
      className: classes.join(' '),
      html: `<span class="${styles.disc}">${glyphSvg(type === 'lift' ? LIFT_PATHS : STAIRS_PATHS)}</span>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

export function ConnectorMarkers({
  index,
  floor,
  connectors,
  link,
  selectedId,
  draggable,
  dragging,
  onSelect,
  onDrag,
  onDrop,
  adding,
}: ConnectorMarkersProps) {
  const level = useMemo(() => new Map(index.geometry.floors.map((f) => [f.id, f.level])), [index]);
  const here = level.get(floor) ?? 0;
  const neighbours = index.geometry.floors
    .filter((f) => Math.abs(f.level - here) === 1)
    .map((f) => f.id);

  // Where each stop on this floor attaches (from the same linking pass as the validation).
  const stops = link.stops.filter((stop) => stop.floor === floor);
  const attached = new Set(stops.map((stop) => stop.connector));
  const addingSnap = adding?.point ? snapToWalkable(index, floor, adding.point) : undefined;

  return (
    <>
      {/* Ghosts first, so the real markers sit on top of them. */}
      {connectors.flatMap((connector) =>
        neighbours
          .filter((other) => connector.floors.includes(other) && connector.positions[other])
          .map((other) => (
            <CircleMarker
              key={`ghost:${connector.id}:${other}`}
              center={toLatLng(connector.positions[other] as Point)}
              radius={14}
              interactive={false}
              className={styles.ghost}
            />
          )),
      )}

      {stops.map((stop) => (
        <Polyline
          key={`snap:${stop.connector}`}
          positions={[toLatLng(stop.position), toLatLng(stop.snap.point)]}
          interactive={false}
          className={styles.snapLine}
        />
      ))}

      {connectors
        .filter((connector) => connector.floors.includes(floor) && connector.positions[floor])
        .map((connector) => {
          const saved = connector.positions[floor] as Point;
          const live = dragging?.id === connector.id ? dragging.point : saved;
          const notWalkable = !attached.has(connector.id);
          return (
            <Fragment key={connector.id}>
              {notWalkable && (
                <CircleMarker
                  center={toLatLng(live)}
                  radius={20}
                  interactive={false}
                  className={styles.warning}
                />
              )}
              <Marker
                position={toLatLng(saved)}
                icon={markerIcon(connector.type, connector.id === selectedId, connector.available)}
                draggable={draggable}
                keyboard
                title={connector.name}
                alt={`${connector.name}${connector.available ? '' : ' (out of order)'}`}
                eventHandlers={{
                  click: () => onSelect(connector.id),
                  drag: (event) =>
                    onDrag(connector.id, fromLatLng((event.target as L.Marker).getLatLng())),
                  dragend: (event) =>
                    onDrop(connector.id, fromLatLng((event.target as L.Marker).getLatLng())),
                }}
              />
            </Fragment>
          );
        })}

      {adding?.point && (
        <>
          {addingSnap && (
            <Polyline
              positions={[toLatLng(adding.point), toLatLng(addingSnap.point)]}
              interactive={false}
              className={styles.snapLine}
            />
          )}
          {/* key: a shape's class is set when it's made (see FloorPlanView), so a
              change of look makes a new one. */}
          <CircleMarker
            key={addingSnap ? 'add:snaps' : 'add:off'}
            center={toLatLng(adding.point)}
            radius={15}
            interactive={false}
            className={addingSnap ? styles.addGhost : styles.warning}
          />
        </>
      )}
    </>
  );
}
