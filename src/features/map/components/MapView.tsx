// The floor plan as a zoomable map. Leaflet's CRS.Simple treats the image as
// a flat surface measured in pixels (no globe, no tiles), which is what an
// indoor plan needs. Children are the pins (see Pins.tsx).
import L from 'leaflet';
import type { ReactNode } from 'react';
import { ImageOverlay, MapContainer, useMapEvents } from 'react-leaflet';
import type { Floor } from '../api';
import { fromLatLng } from '../logic';
import styles from './MapView.module.css';

interface MapViewProps {
  floor: Floor;
  children?: ReactNode;
  /** Admin editor: called with plan coordinates when the map is clicked. */
  onMapClick?: (point: { x: number; y: number }) => void;
  /** Accessible description of the map. */
  label: string;
}

function ClickHandler({
  floor,
  onMapClick,
}: {
  floor: Floor;
  onMapClick: (point: { x: number; y: number }) => void;
}) {
  useMapEvents({
    click: (event) => onMapClick(fromLatLng(event.latlng.lat, event.latlng.lng, floor)),
  });
  return null;
}

export function MapView({ floor, children, onMapClick, label }: MapViewProps) {
  // The image covers (0,0) to (height,width) in Leaflet's [lat, lng] order.
  const bounds: L.LatLngBoundsExpression = [
    [0, 0],
    [floor.height, floor.width],
  ];
  return (
    <div
      className={styles.frame}
      role="region"
      aria-label={label}
      // The frame takes the plan's shape, so the plan fills it edge to edge.
      style={{ aspectRatio: `${floor.width} / ${floor.height}` }}
    >
      {/* key: a new floor gets a fresh map, fitted to its own image. */}
      <MapContainer
        key={floor.id}
        className={styles.map}
        crs={L.CRS.Simple}
        bounds={bounds}
        maxBounds={[
          [-floor.height * 0.25, -floor.width * 0.25],
          [floor.height * 1.25, floor.width * 1.25],
        ]}
        minZoom={-3}
        maxZoom={2}
        zoomSnap={0.25}
        attributionControl={false}
      >
        <ImageOverlay url={floor.image_path} bounds={bounds} />
        {onMapClick && <ClickHandler floor={floor} onMapClick={onMapClick} />}
        {children}
      </MapContainer>
    </div>
  );
}
