// The pins on the map. Each is a Leaflet Marker with a small HTML icon, so it
// can be reached with the keyboard (Tab, then Enter) and has a title.
//   RoomPin    teal circle
//   BusyPin    ink circle with a teal ring: the room is in use now
//   ReportPin  orange square with "!": an open fix-it report
import L from 'leaflet';
import { Marker } from 'react-leaflet';
import type { Floor } from '../api';
import { toLatLng } from '../logic';
import styles from './Pins.module.css';

interface PinProps {
  floor: Floor;
  x: number;
  y: number;
  title: string;
  selected?: boolean;
  onSelect?: () => void;
}

function makeIcon(className: string, html = '') {
  return L.divIcon({ className, html, iconSize: [22, 22], iconAnchor: [11, 11] });
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
}: PinProps & { className: string; html?: string }) {
  return (
    <Marker
      position={toLatLng(x, y, floor)}
      icon={makeIcon(`${className}${selected ? ` ${styles.selected}` : ''}`, html)}
      title={title}
      keyboard
      eventHandlers={onSelect ? { click: onSelect } : undefined}
    />
  );
}

export function RoomPin(props: PinProps) {
  return <Pin {...props} className={styles.room} />;
}

export function BusyPin(props: PinProps) {
  return <Pin {...props} className={styles.busy} />;
}

export function ReportPin(props: PinProps) {
  return <Pin {...props} className={styles.report} html="!" />;
}
