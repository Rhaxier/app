// The traced floor plan, drawn from geometry.json, as a zoomable map. One
// drawing for every map screen: the admin's Classrooms tab now, and later
// the stairs and lifts editor and the student map.
//
// Why Leaflet: the old map already uses it (CRS.Simple: a flat surface, no
// globe), and it gives pan, pinch zoom and keyboard zoom for free. The rooms
// are SVG shapes styled only by CSS classes, so the colours come from the
// tokens and follow light and dark mode.
//
// The plan is drawn to scale (../planScale.ts): line widths are set in metres
// and room names in map units, so both follow the zoom.
//
// Every shape gets its look from a CSS class passed as `className` when it's
// made, never inside `pathOptions`: react-leaflet applies pathOptions after
// the shape is drawn, and Leaflet only reads the class while drawing, so a
// class there is lost and the shape shows Leaflet's default thick blue. (It
// only looks right in development, where React draws every layer twice.)
// A shape whose class can change has the class in its key, so it's remade.
//
// Coordinates: see ./latlng.ts.
import L from 'leaflet';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  CircleMarker,
  MapContainer,
  Pane,
  Polygon,
  Polyline,
  SVGOverlay,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet';
import { prefersReducedMotion } from '@/lib/motion';
import { FollowFrameSize, RefitOnMargins } from '../../components/FitPlan.tsx';
import { fitPadding, type MapMargins } from '../../mapMargins.ts';
import { entranceDoors } from '../assignments.ts';
import { distance, indexGeometry, regionAt } from '../graph.ts';
import { LABEL_MAX_PX, placeLabel, pxPerMetre, pxPerUnit } from '../planScale.ts';
import type { FloorId, Geometry, Point, Region } from '../types.ts';
import walls from '../data/walls.json';
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
  /** A quiet background: rooms can't be picked and have no tooltips (the stairs and lifts editor). */
  quiet?: boolean;
  /** Any click on the plan, in map coordinates (the editor's Add tools). */
  onMapClick?: (point: Point) => void;
  /** The pointer's position over the plan, or null when it leaves (the Add tools' ghost marker). */
  onPointerMove?: (point: Point | null) => void;
  /** Show a crosshair cursor (an Add tool is active). */
  crosshair?: boolean;
  /** Fill the screen behind floating controls; the plan fits between these margins (px). */
  immersive?: MapMargins;
  /** Told the zoom level when it changes (the route line is scaled with it). */
  onZoom?: (zoom: number) => void;
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
  quiet = false,
  onMapClick,
  onPointerMove,
  crosshair = false,
  immersive,
  onZoom,
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
  // What's drawn, bottom to top: voids first (courtyards, and roofs of the
  // floors below, which show the building's outline), then everything else.
  // Voids wholly outside the plan's bounds are the drawing's page margins,
  // picked up by the tracing, and are left out.
  const drawn = useMemo(
    () => [
      ...regions.filter((region) => region.kind === 'void' && insidePlan(region, bounds)),
      ...regions.filter((region) => region.kind !== 'void'),
    ],
    [regions, bounds],
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
      className={[
        styles.frame,
        immersive && styles.immersive,
        quiet && styles.quiet,
        crosshair && styles.crosshair,
      ]
        .filter(Boolean)
        .join(' ')}
      role="region"
      aria-label={label}
      // Framed: the frame takes the plan's shape. Immersive: the whole screen.
      style={immersive ? undefined : { aspectRatio: `${width} / ${height}` }}
    >
      <MapContainer
        className={styles.map}
        crs={L.CRS.Simple}
        bounds={mapBounds}
        boundsOptions={immersive ? fitPadding(immersive) : undefined}
        // How far the plan can be dragged off screen. Full screen needs more
        // room, so a student can pull the plan up from under the directions
        // card without it springing back.
        maxBounds={L.latLngBounds(mapBounds as L.LatLngTuple[]).pad(immersive ? 1.2 : 0.5)}
        minZoom={-4}
        maxZoom={2}
        zoomSnap={0.25}
        zoomControl={false}
        zoomAnimation={animate}
        fadeAnimation={animate}
        markerZoomAnimation={animate}
        attributionControl={false}
      >
        <ZoomControl position={immersive ? 'bottomright' : 'topleft'} />
        {immersive && <RefitOnMargins bounds={mapBounds} margins={immersive} />}
        <LineScale metresPerUnit={geometry.metresPerUnit} />
        <FollowFrameSize />
        {onZoom && <ZoomWatcher onZoom={onZoom} />}
        {/* key: shapes are made once per floor; a name change redraws only that room. */}
        {drawn.map((region) => (
          <RegionShape
            key={`${region.id}:${named?.has(region.id) ? 'n' : 'u'}`}
            region={region}
            named={named?.has(region.id) ?? false}
            name={names?.[region.id]}
            quiet={quiet}
          />
        ))}
        <WallLines floor={floor} />
        {places.map((place) => (
          <CircleMarker
            key={place.id}
            center={toLatLng(place)}
            radius={6}
            interactive={!quiet}
            className={styles.place}
          >
            {!quiet && <Tooltip>{names?.[place.id] || place.id}</Tooltip>}
          </CircleMarker>
        ))}
        {entrances.map((door) => (
          <CircleMarker
            key={`${door.id}:${named?.has(door.id) ? 'n' : 'u'}`}
            center={toLatLng(door)}
            radius={4}
            interactive={!quiet}
            className={named?.has(door.id) ? styles.entranceNamed : styles.entrance}
          >
            {!quiet && <Tooltip>{names?.[door.id] || `Entrance ${door.id}`}</Tooltip>}
          </CircleMarker>
        ))}
        {/* The selection is its own shape on top, so it can change without redrawing the rest. */}
        {selectedRegion && (
          <Polygon
            key={`selected:${selectedRegion.id}`}
            positions={[ring(selectedRegion.polygon), ...(selectedRegion.holes ?? []).map(ring)]}
            interactive={false}
            className={styles.selected}
          />
        )}
        {selectedPoint && (
          <CircleMarker
            key={`selected:${selectedPoint.id}`}
            center={toLatLng(selectedPoint)}
            radius={10}
            interactive={false}
            className={styles.selectedPoint}
          />
        )}
        {names && named && (
          <RoomLabels
            bounds={mapBounds}
            plan={bounds}
            regions={drawn}
            named={named}
            names={names}
          />
        )}
        {onSelect && <ClickToSelect geometry={geometry} floor={floor} onSelect={onSelect} />}
        {(onMapClick || onPointerMove) && (
          <PointerEvents onMapClick={onMapClick} onPointerMove={onPointerMove} />
        )}
        {focus && <FocusOn geometry={geometry} focus={focus} animate={animate} />}
        {children}
      </MapContainer>
    </div>
  );
}

function RegionShape({
  region,
  named,
  name,
  quiet,
}: {
  region: Region;
  named: boolean;
  name?: string;
  quiet: boolean;
}) {
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
    <Polygon
      positions={positions}
      className={className}
      interactive={!quiet && region.kind === 'room'}
    >
      {!quiet && region.kind === 'room' && (
        <Tooltip sticky>{name || `${region.id} (no name)`}</Tooltip>
      )}
    </Polygon>
  );
}

/**
 * The walls as the school's layout draws them (walls.json, traced from the
 * PDF by tools/map-extract/walls.py), over the room and corridor shapes.
 * The shapes alone lose the walls inside open areas such as the central hall,
 * because the tracing merges those areas into one corridor. Gaps in these
 * lines are the doorways the layout marks in green. Their own pane keeps them
 * above the shapes even when a renamed room is redrawn, and below the names.
 */
function WallLines({ floor }: { floor: FloorId }) {
  const lines = useMemo(
    () =>
      ((walls as Record<string, number[][]>)[floor] ?? []).map((line) => {
        const points: L.LatLngTuple[] = [];
        for (let i = 0; i < line.length; i += 2)
          points.push(toLatLng({ x: line[i], y: line[i + 1] }));
        return points;
      }),
    [floor],
  );
  return (
    <Pane name="walls" style={{ zIndex: 420, pointerEvents: 'none' }}>
      {/* key: one path per floor, replaced when the floor changes. */}
      <Polyline key={floor} positions={lines} className={styles.walls} interactive={false} />
    </Pane>
  );
}

/** Does any part of the region lie within the plan's bounds? */
function insidePlan(region: Region, bounds: Geometry['bounds']): boolean {
  return region.polygon.some(
    ([x, y]) => x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY,
  );
}

/**
 * Keeps two sizes on the map for FloorPlanView.module.css: --px-per-m (screen
 * pixels per metre, for line widths) and --label-max (10pt in map units, the
 * size room names stop growing at). Updated when a zoom ends: while one is
 * running, Leaflet stretches the drawing as a whole, lines and names
 * included, so they already change at the zoom's rate.
 */
function LineScale({ metresPerUnit }: { metresPerUnit: number }) {
  const map = useMapEvents({ zoomend: () => update() });
  function update() {
    const zoom = map.getZoom();
    const style = map.getContainer().style;
    style.setProperty('--px-per-m', `${pxPerMetre(zoom, metresPerUnit)}px`);
    // In the names' SVG a CSS pixel is one map unit.
    style.setProperty('--label-max', `${LABEL_MAX_PX / pxPerUnit(zoom)}px`);
  }
  useEffect(update, [map, metresPerUnit]);
  return null;
}

/**
 * Every named room's name, drawn as SVG text on top of the plan, in map units,
 * so it shrinks and grows with the plan, smoothly even mid-zoom, until it
 * reaches 10pt and stops (--label-max). Each room's place, angle and size
 * come from placeLabel and never change with the zoom, so the names don't
 * jump about, and rooms of the same shape show their names alike.
 */
function RoomLabels({
  bounds,
  plan,
  regions,
  named,
  names,
}: {
  bounds: L.LatLngBoundsExpression;
  plan: Geometry['bounds'];
  regions: Region[];
  named: ReadonlySet<string>;
  names: Record<string, string>;
}) {
  const map = useMap();
  const font = useLabelFont(map.getContainer());

  // Worked out once per floor, name and font, not on every zoom.
  const labels = useMemo(() => {
    const list: { id: string; name: string; x: number; y: number; angle: number; size: number }[] =
      [];
    for (const region of regions) {
      const name = names[region.id];
      if (region.kind !== 'room' || !named.has(region.id) || !name) continue;
      const placement = placeLabel(region, measureEm(name, font));
      if (placement) list.push({ id: region.id, name, ...placement });
    }
    return list;
  }, [regions, named, names, font]);

  const viewBox = `${plan.minX} ${plan.minY} ${plan.maxX - plan.minX} ${plan.maxY - plan.minY}`;
  return (
    <Pane name="room-labels" style={{ zIndex: 450, pointerEvents: 'none' }}>
      <SVGOverlay
        bounds={bounds as L.LatLngBoundsLiteral}
        attributes={{
          viewBox,
          preserveAspectRatio: 'none',
          class: styles.labels,
          'aria-hidden': 'true',
        }}
      >
        {labels.map((label) => (
          // The name goes in as text, never as markup: room names are typed by admins.
          <text
            key={label.id}
            data-room-label=""
            x={label.x}
            y={label.y}
            transform={label.angle ? `rotate(${label.angle} ${label.x} ${label.y})` : undefined}
            style={{ '--size': `${label.size}px` } as CSSProperties}
          >
            {label.name}
          </text>
        ))}
      </SVGOverlay>
    </Pane>
  );
}

/**
 * The CSS font of a room name (FloorPlanView.module.css, .labels text), for
 * measuring it. Measured again once the app's typeface has loaded, since a
 * fallback font has different widths.
 */
function useLabelFont(container: HTMLElement): string {
  const [fontsLoaded, setFontsLoaded] = useState(0);
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => live && setFontsLoaded((n) => n + 1));
    return () => {
      live = false;
    };
  }, []);
  return useMemo(
    () => `400 100px ${getComputedStyle(container).fontFamily}`,
    // fontsLoaded: re-read after the typeface arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [container, fontsLoaded],
  );
}

let measuringContext: CanvasRenderingContext2D | null | undefined;

/**
 * How wide `text` is in ems (its width at a font size of 1), measured in
 * `font`, which is set at 100px for precision.
 */
function measureEm(text: string, font: string): number {
  if (measuringContext === undefined) {
    // Test runs (jsdom) have no canvas; they get an estimate instead.
    measuringContext = /jsdom/i.test(navigator.userAgent)
      ? null
      : document.createElement('canvas').getContext('2d');
  }
  if (!measuringContext) return text.length * 0.55;
  measuringContext.font = font;
  return measuringContext.measureText(text).width / 100;
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

/** Reports the zoom level now and after every zoom. */
function ZoomWatcher({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => onZoom(map.getZoom()), [map, onZoom]);
  return null;
}

/** Raw clicks and pointer moves, in map coordinates, for tools that place things. */
function PointerEvents({
  onMapClick,
  onPointerMove,
}: {
  onMapClick?: (point: Point) => void;
  onPointerMove?: (point: Point | null) => void;
}) {
  useMapEvents({
    click: (event) => onMapClick?.(fromLatLng(event.latlng)),
    mousemove: (event) => onPointerMove?.(fromLatLng(event.latlng)),
    mouseout: () => onPointerMove?.(null),
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
