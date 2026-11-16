// Pins on the indoor map, in map coordinates. They reuse the old map's pin
// drawings (Pins.module.css, design PDF page 11), so both maps look alike.
// Every pin is 44px to tap, has a title, and the tappable ones are reachable
// with the keyboard (Tab, then Enter).
import L from 'leaflet';
import { Marker } from 'react-leaflet';
import pinStyles from '@/features/map/components/Pins.module.css';
import type { Point } from '../types.ts';
import { fromLatLng, toLatLng } from './latlng.ts';
import styles from './NavPins.module.css';

const TAP = 44;

// Text from the database goes into Leaflet's HTML, so it is escaped first.
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function icon(className: string, html: string, size: [number, number] = [TAP, TAP]) {
  return L.divIcon({
    className,
    html,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1] / 2],
  });
}

/** Open fix-it reports in one room: how many, in the orange count pin. */
export function ReportCountPin({
  at,
  count,
  title,
  onSelect,
}: {
  at: Point;
  count: number;
  title: string;
  onSelect: () => void;
}) {
  return (
    <Marker
      position={toLatLng(at)}
      title={title}
      keyboard
      icon={icon(
        `${pinStyles.pin} ${pinStyles.report}`,
        `<span class="${pinStyles.countRing}"></span><span class="${pinStyles.count}">${count}</span>`,
      )}
      eventHandlers={{ click: onSelect }}
    />
  );
}

/** A room with an approved booking right now: the green dot with a halo. Not tappable. */
export function BusyDot({ at, title }: { at: Point; title: string }) {
  return (
    <Marker
      position={toLatLng(at)}
      title={title}
      interactive={false}
      keyboard={false}
      icon={icon(
        `${pinStyles.pin} ${pinStyles.busy}`,
        `<span class="${pinStyles.busyDot}"></span>`,
      )}
    />
  );
}

/**
 * "I'm here": the blue core in a soft halo, draggable. Where it is dropped
 * goes to `onDrop`; the pin itself jumps back until the parent accepts the
 * spot (snapped to a corridor) and moves it there.
 */
export function HereMarker({ at, onDrop }: { at: Point; onDrop: (point: Point) => void }) {
  return (
    <Marker
      position={toLatLng(at)}
      title="I'm here (drag to move)"
      alt="I'm here"
      draggable
      keyboard
      zIndexOffset={1000}
      icon={icon(
        `${pinStyles.pin} ${pinStyles.here} ${styles.draggable}`,
        `<span class="${pinStyles.hereHalo}"></span><span class="${pinStyles.hereCore}"></span>`,
      )}
      eventHandlers={{
        dragend: (event) => {
          const marker = event.target as L.Marker;
          const dropped = fromLatLng(marker.getLatLng());
          marker.setLatLng(toLatLng(at));
          onDrop(dropped);
        },
      }}
    />
  );
}

/** The end of the route: the destination. */
export function DestinationPin({ at, title }: { at: Point; title: string }) {
  return (
    <Marker
      position={toLatLng(at)}
      title={title}
      interactive={false}
      keyboard={false}
      zIndexOffset={900}
      icon={icon(styles.destination, `<span class="${styles.destinationDot}"></span>`)}
    />
  );
}

/**
 * The chip at a change of floor ("Take the lift up to Third Floor"). Tapping
 * it, or Enter on it, shows the other floor.
 */
export function FloorChangeChip({
  at,
  text,
  onPick,
}: {
  at: Point;
  text: string;
  onPick: () => void;
}) {
  const width = Math.min(260, 24 + text.length * 7);
  return (
    <Marker
      position={toLatLng(at)}
      title={text}
      keyboard
      zIndexOffset={1100}
      icon={L.divIcon({
        className: styles.chip,
        html: `<span class="glass thick ${styles.chipBody}">${escapeHtml(text)}</span>`,
        iconSize: [width, TAP],
        // Sits just above the stairs or lift, pointing at it.
        iconAnchor: [width / 2, TAP + 6],
      })}
      eventHandlers={{ click: onPick }}
    />
  );
}
