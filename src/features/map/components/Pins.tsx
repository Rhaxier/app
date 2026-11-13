// The pins on the map, drawn to the design's micro-details (design PDF page 11).
// Each is a Leaflet Marker with a small HTML icon, so it can be reached with
// the keyboard (Tab, then Enter) and has a title. Tappable pins are 44px
// across even when what you see is smaller.
//   RoomPin    a small dot; once chosen, the "selected room" tag with its code
//   BusyPin    a green dot with a halo: an approved booking is on there now
//   ReportPin  the fix-it count pin: 26px orange, white numeral, 40px ring
//   HerePin    "You are here": a blue core in a soft halo; not tappable
import L from 'leaflet';
import { Marker } from 'react-leaflet';
import type { Floor } from '../api';
import { toLatLng } from '../logic';
import styles from './Pins.module.css';

const TAP_SIZE = 44;

interface PinProps {
  floor: Floor;
  x: number;
  y: number;
  title: string;
  selected?: boolean;
  onSelect?: () => void;
}

// Leaflet puts this HTML straight into the page, and room codes are typed by
// admins, so anything that came from the database is escaped first.
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function Pin({
  floor,
  x,
  y,
  title,
  selected,
  onSelect,
  className,
  html,
}: PinProps & { className: string; html: string }) {
  const icon = L.divIcon({
    className: [styles.pin, className, selected && styles.selected].filter(Boolean).join(' '),
    html,
    iconSize: [TAP_SIZE, TAP_SIZE],
    iconAnchor: [TAP_SIZE / 2, TAP_SIZE / 2],
  });
  return (
    <Marker
      position={toLatLng(x, y, floor)}
      icon={icon}
      title={title}
      keyboard={Boolean(onSelect)}
      interactive={Boolean(onSelect)}
      eventHandlers={onSelect ? { click: onSelect } : undefined}
    />
  );
}

/** A room. Chosen, it becomes the tag: accent fill at 20%, 1.6px accent edge, code in light blue. */
export function RoomPin({ code, ...props }: PinProps & { code: string }) {
  const html = props.selected
    ? `<span class="${styles.roomTag}">${escapeHtml(code)}</span>`
    : `<span class="${styles.roomDot}"></span>`;
  return <Pin {...props} className={styles.room} html={html} />;
}

export function BusyPin(props: PinProps & { code: string }) {
  const html = props.selected
    ? `<span class="${styles.roomTag}">${escapeHtml(props.code)}</span>`
    : `<span class="${styles.busyDot}"></span>`;
  return <Pin {...props} className={styles.busy} html={html} />;
}

/** Open fix-it reports at one spot: how many, in the orange count pin. */
export function ReportPin({ count, ...props }: PinProps & { count: number }) {
  const html = `<span class="${styles.countRing}"></span><span class="${styles.count}">${count}</span>`;
  return <Pin {...props} className={styles.report} html={html} />;
}

/** "You are here": 7px core, 16px halo at 14%, no stroke, no shadow. */
export function HerePin({ floor, x, y }: Pick<PinProps, 'floor' | 'x' | 'y'>) {
  return (
    <Pin
      floor={floor}
      x={x}
      y={y}
      title="You are here"
      className={styles.here}
      html={`<span class="${styles.hereHalo}"></span><span class="${styles.hereCore}"></span>`}
    />
  );
}
