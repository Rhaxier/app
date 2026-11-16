// The traced floor plan, drawn from geometry.json, as a zoomable map. One
// drawing for every map screen: the admin's Classrooms tab now, and later
// the stairs and lifts editor and the student map.
//
// Why Leaflet: the old map already uses it (CRS.Simple: a flat surface, no
// globe), and it gives pan, pinch zoom and keyboard zoom for free. The rooms
// are SVG shapes styled only by CSS classes, so the colours come from the
// tokens and follow light and dark mode.
//
// Coordinates: see ./latlng.ts.
import L from 'leaflet';
import { useEffect, useMemo, type ReactNode } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet';
import { prefersReducedMotion } from '@/lib/motion';
import { entranceDoors } from '../assignments.ts';
import { distance, indexGeometry, regionAt } from '../graph.ts';
import type { FloorId, Geometry, Point, Region } from '../types.ts';
import styles from './FloorPlanView.module.css';
import { fromLatLng, toLatLng } from './latlng.ts';

const ring = (points: [number, number][]) => points.map(([x, y]) => toLatLng({ x, y }));

// A tap this close to a place or entrance marker picks it (metres).
const PICK_RADIUS_M = 2;

interface FloorPlanViewProps {
  geometry: Geometry;
  floor: FloorId;
  /** Accessible description of the map. */
  label: string;
  /** Room, place or entrance ids that have a name (drawn darker than unnamed ones). */
  named?: ReadonlySet<string>;
  /** Display names for the hover tooltips, by id. */
  names?: Record<string, string>;
  selectedId?: string | null;
  /** Called with the room, place or entrance under a click (nothing for corridors). */
  onSelect?: (id: string) => void;
  /** Pans to this id when `seq` changes (a row picked in a list, not a click on the map). */
  focus?: { id: string; seq: number } | null;
  /** Extra layers drawn on top (markers, routes). */
  children?: ReactNode;
}

export function FloorPlanView({
  geometry,
  floor,
  label,
  named,
  names,
  selectedId,
  onSelect,
  focus,
  children,
}: FloorPlanViewProps) {
  const { bounds } = geometry;
  // Every floor shares one coordinate system, so the view is the same on each.
  const mapBounds = useMemo<L.LatLngBoundsExpression>(
    () => [
      toLatLng({ x: bounds.minX, y: bounds.maxY }),
      toLatLng({ x: bounds.maxX, y: bounds.minY }),
    ],
    [bounds],
  );
  const regions = useMemo(
    () => geometry.regions.filter((region) => region.floor === floor),
    [geometry, floor],
  );
  const places = useMemo(
    () => geometry.places.filter((place) => place.floor === floor),
    [geometry, floor],
  );
  const entrances = useMemo(
    () => entranceDoors(geometry).filter((door) => door.floor === floor),
    [geometry, floor],
  );
  const selectedRegion = regions.find((region) => region.id === selectedId);
  const selectedPoint =
    places.find((place) => place.id === selectedId) ??
    entrances.find((door) => door.id === selectedId);
  const animate = !prefersReducedMotion();
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  return (
    <div
      className={styles.frame}
      role="region"
      aria-label={label}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <MapContainer
        className={styles.map}
        crs={L.CRS.Simple}
        bounds={mapBounds}
        maxBounds={L.latLngBounds(mapBounds as L.LatLngTuple[]).pad(0.5)}
        minZoom={-4}
        maxZoom={2}
        zoomSnap={0.25}
        zoomControl={false}
        zoomAnimation={animate}
        fadeAnimation={animate}
        markerZoomAnimation={animate}
        attributionControl={false}
      >
        <ZoomControl position="topleft" />
        {/* key: shapes are made once per floor; a name change redraws only that room. */}
        {regions.map((region) => (
          <RegionShape
            key={`${region.id}:${named?.has(region.id) ? 'n' : 'u'}`}
            region={region}
            named={named?.has(region.id) ?? false}
            name={names?.[region.id]}
          />
        ))}
        {places.map((place) => (
          <CircleMarker
            key={place.id}
            center={toLatLng(place)}
            radius={6}
            pathOptions={{ className: styles.place }}
          >
            <Tooltip>{names?.[place.id] || place.id}</Tooltip>
          </CircleMarker>
        ))}
        {entrances.map((door) => (
          <CircleMarker
            key={door.id}
            center={toLatLng(door)}
            radius={4}
            pathOptions={{
              className: named?.has(door.id) ? styles.entranceNamed : styles.entrance,
            }}
          >
            <Tooltip>{names?.[door.id] || `Entrance ${door.id}`}</Tooltip>
          </CircleMarker>
        ))}
        {/* The selection is its own shape on top, so it can change without redrawing the rest. */}
        {selectedRegion && (
          <Polygon
            key={`selected:${selectedRegion.id}`}
            positions={[ring(selectedRegion.polygon), ...(selectedRegion.holes ?? []).map(ring)]}
            interactive={false}
            pathOptions={{ className: styles.selected }}
          />
        )}
        {selectedPoint && (
          <CircleMarker
            key={`selected:${selectedPoint.id}`}
            center={toLatLng(selectedPoint)}
            radius={10}
            interactive={false}
            pathOptions={{ className: styles.selected }}
          />
        )}
        {onSelect && <ClickToSelect geometry={geometry} floor={floor} onSelect={onSelect} />}
        {focus && <FocusOn geometry={geometry} focus={focus} animate={animate} />}
        {children}
      </MapContainer>
    </div>
  );
}

function RegionShape({ region, named, name }: { region: Region; named: boolean; name?: string }) {
  const className =
    region.kind === 'room'
      ? named
        ? styles.room
        : styles.roomUnnamed
      : region.kind === 'stairwell'
        ? styles.stairwell
        : region.kind === 'void'
          ? styles.void
          : styles.corridor;
  const positions = [ring(region.polygon), ...(region.holes ?? []).map(ring)];
  return (
    <Polygon positions={positions} pathOptions={{ className }} interactive={region.kind === 'room'}>
      {region.kind === 'room' && <Tooltip sticky>{name || `${region.id} (no name)`}</Tooltip>}
    </Polygon>
  );
}

/** A click picks the place or entrance marker it is on, otherwise the room under it. */
function ClickToSelect({
  geometry,
  floor,
  onSelect,
}: {
  geometry: Geometry;
  floor: FloorId;
  onSelect: (id: string) => void;
}) {
  const index = useMemo(() => indexGeometry(geometry), [geometry]);
  useMapEvents({
    click(event) {
      const point = fromLatLng(event.latlng);
      const reach = PICK_RADIUS_M / geometry.metresPerUnit;
      const markers = [
        ...geometry.places.filter((place) => place.floor === floor),
        ...entranceDoors(geometry).filter((door) => door.floor === floor),
      ];
      let nearest: { id: string; d: number } | null = null;
      for (const marker of markers) {
        const d = distance(point, marker);
        if (d <= reach && (!nearest || d < nearest.d)) nearest = { id: marker.id, d };
      }
      if (nearest) {
        onSelect(nearest.id);
        return;
      }
      const region = regionAt(index, floor, point);
      if (region?.kind === 'room') onSelect(region.id);
    },
  });
  return null;
}

/** Pans to an item picked from a list, zooming in a little if the whole school is in view. */
function FocusOn({
  geometry,
  focus,
  animate,
}: {
  geometry: Geometry;
  focus: { id: string; seq: number };
  animate: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    const region = geometry.regions.find((r) => r.id === focus.id);
    const point: Point | undefined = region
      ? { x: region.labelAt[0], y: region.labelAt[1] }
      : (geometry.places.find((p) => p.id === focus.id) ??
        geometry.doors.find((d) => d.id === focus.id));
    if (!point) return;
    const zoom = Math.max(map.getZoom(), -1);
    map.setView(toLatLng(point), zoom, { animate });
    // Only a new pick (seq) moves the map; re-renders must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.seq]);
  return null;
}
