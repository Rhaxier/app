// The floor plan as a zoomable map. Leaflet's CRS.Simple treats the image as
// a flat surface measured in pixels (no globe, no tiles), which is what an
// indoor plan needs. Children are the pins (see Pins.tsx).
//
// Two shapes:
//   framed     a card the plan's own shape (the admin's room editor)
//   immersive  the whole screen, under floating glass controls (the Campus
//              map, design PDF page 6). `inset` keeps the plan clear of them.
//
// In dark mode the plan image is inverted into a dark architect's plan
// (--plan-filter in tokens.css); the pins are drawn on top and keep their colours.
import L from 'leaflet';
import type { ReactNode } from 'react';
import { ImageOverlay, MapContainer, useMapEvents, ZoomControl } from 'react-leaflet';
import { prefersReducedMotion } from '@/lib/motion';
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
  /** Fill the screen; the plan fits between these margins (px): [top, bottom]. */
  immersive?: { top: number; bottom: number };
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

export function MapView({ floor, children, onMapClick, label, immersive }: MapViewProps) {
  // The image covers (0,0) to (height,width) in Leaflet's [lat, lng] order.
  const bounds: L.LatLngBoundsExpression = [
    [0, 0],
    [floor.height, floor.width],
  ];
  // Zooming glides, except for people who asked their device for less motion.
  const animate = !prefersReducedMotion();
  return (
    <div
      className={immersive ? `${styles.frame} ${styles.immersive}` : styles.frame}
      role="region"
      aria-label={label}
      // Framed: the frame takes the plan's shape, so the plan fills it edge to edge.
      style={immersive ? undefined : { aspectRatio: `${floor.width} / ${floor.height}` }}
    >
      {/* key: a new floor gets a fresh map, fitted to its own image. */}
      <MapContainer
        key={floor.id}
        className={styles.map}
        crs={L.CRS.Simple}
        bounds={bounds}
        boundsOptions={
          immersive
            ? { paddingTopLeft: [16, immersive.top], paddingBottomRight: [16, immersive.bottom] }
            : undefined
        }
        maxBounds={[
          [-floor.height * 0.5, -floor.width * 0.5],
          [floor.height * 1.5, floor.width * 1.5],
        ]}
        minZoom={-3}
        maxZoom={2}
        zoomSnap={0.25}
        zoomControl={false}
        zoomAnimation={animate}
        fadeAnimation={animate}
        markerZoomAnimation={animate}
        attributionControl={false}
      >
        <ImageOverlay url={floor.image_path} bounds={bounds} className={styles.plan} />
        <ZoomControl position={immersive ? 'bottomright' : 'topleft'} />
        {onMapClick && <ClickHandler floor={floor} onMapClick={onMapClick} />}
        {children}
      </MapContainer>
    </div>
  );
}
