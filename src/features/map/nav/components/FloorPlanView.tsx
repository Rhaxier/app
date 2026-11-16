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
// and follow the zoom, and a room's name appears once the room is big enough
// on screen to hold it.
//
// Coordinates: see ./latlng.ts.
import L from 'leaflet';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Pane,
  Polygon,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet';
import { prefersReducedMotion } from '@/lib/motion';
import { entranceDoors } from '../assignments.ts';
import { distance, indexGeometry, regionAt } from '../graph.ts';
import { LABEL_FONT_SIZE, labelMinScale, pxPerMetre, pxPerUnit } from '../planScale.ts';
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
  /** A quiet background: rooms can't be picked and have no tooltips (the stairs and lifts editor). */
  quiet?: boolean;
  /** Any click on the plan, in map coordinates (the editor's Add tools). */
  onMapClick?: (point: Point) => void;
  /** The pointer's position over the plan, or null when it leaves (the Add tools' ghost marker). */
  onPointerMove?: (point: Point | null) => void;
  /** Show a crosshair cursor (an Add tool is active). */
  crosshair?: boolean;
  /** Fill the screen behind floating controls; the plan fits between these margins (px). */
  immersive?: { top: number; bottom: number };
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
        boundsOptions={
          immersive
            ? { paddingTopLeft: [16, immersive.top], paddingBottomRight: [16, immersive.bottom] }
            : undefined
        }
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
        <LineScale metresPerUnit={geometry.metresPerUnit} />
        {onZoom && <ZoomWatcher onZoom={onZoom} />}
        {/* key: shapes are made once per floor; a name change redraws only that room. */}
        {regions.map((region) => (
          <RegionShape
            key={`${region.id}:${named?.has(region.id) ? 'n' : 'u'}`}
            region={region}
            named={named?.has(region.id) ?? false}
            name={names?.[region.id]}
            quiet={quiet}
          />
        ))}
        {places.map((place) => (
          <CircleMarker
            key={place.id}
            center={toLatLng(place)}
            radius={6}
            interactive={!quiet}
            pathOptions={{ className: styles.place }}
          >
            {!quiet && <Tooltip>{names?.[place.id] || place.id}</Tooltip>}
          </CircleMarker>
        ))}
        {entrances.map((door) => (
          <CircleMarker
            key={door.id}
            center={toLatLng(door)}
            radius={4}
            interactive={!quiet}
            pathOptions={{
              className: named?.has(door.id) ? styles.entranceNamed : styles.entrance,
            }}
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
            pathOptions={{ className: styles.selected }}
          />
        )}
        {selectedPoint && (
          <CircleMarker
            key={`selected:${selectedPoint.id}`}
            center={toLatLng(selectedPoint)}
            radius={10}
            interactive={false}
            pathOptions={{ className: styles.selectedPoint }}
          />
        )}
        {names && named && <RoomLabels regions={regions} named={named} names={names} />}
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
      pathOptions={{ className }}
      interactive={!quiet && region.kind === 'room'}
    >
      {!quiet && region.kind === 'room' && (
        <Tooltip sticky>{name || `${region.id} (no name)`}</Tooltip>
      )}
    </Polygon>
  );
}

/**
 * Keeps --px-per-m (screen pixels per metre) on the map, for the line widths
 * in FloorPlanView.module.css. Updated when a zoom ends: while one is running,
 * Leaflet stretches the drawing as a whole, lines included, so they already
 * change at the zoom's rate.
 */
function LineScale({ metresPerUnit }: { metresPerUnit: number }) {
  const map = useMapEvents({ zoomend: () => update() });
  function update() {
    const px = pxPerMetre(map.getZoom(), metresPerUnit);
    map.getContainer().style.setProperty('--px-per-m', `${px}px`);
  }
  useEffect(update, [map, metresPerUnit]);
  return null;
}

/**
 * Each named room's name, shown once the room is big enough on screen to hold
 * it at 10pt with a little space around it (labelMinScale), hidden again when
 * zooming out makes it too small.
 *
 * When a zoom starts, names that won't fit at the new zoom go straight away,
 * so none overlaps a wall as the plan shrinks; names that now fit appear when
 * it ends.
 */
function RoomLabels({
  regions,
  named,
  names,
}: {
  regions: Region[];
  named: ReadonlySet<string>;
  names: Record<string, string>;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const [target, setTarget] = useState<number | null>(null);
  useMapEvents({
    zoomanim: (event) => setTarget(event.zoom),
    zoomend: () => {
      setTarget(null);
      setZoom(map.getZoom());
    },
  });
  const font = useLabelFont(map.getContainer());

  // The scale at which each name first fits. Depends only on the rooms, the
  // names and the font, so it's worked out once, not on every zoom.
  const maxScale = pxPerUnit(map.getMaxZoom());
  const labels = useMemo(() => {
    const list: { region: Region; name: string; width: number; minScale: number }[] = [];
    for (const region of regions) {
      const name = names[region.id];
      if (region.kind !== 'room' || !named.has(region.id) || !name) continue;
      const width = measureText(name, font);
      const minScale = labelMinScale(region, width, maxScale);
      if (minScale !== null) list.push({ region, name, width, minScale });
    }
    return list;
  }, [regions, named, names, font, maxScale]);

  const scale = pxPerUnit(Math.min(zoom, target ?? zoom));
  return (
    <Pane name="room-labels" style={{ zIndex: 450, pointerEvents: 'none' }}>
      {labels
        .filter((label) => label.minScale <= scale)
        .map((label) => (
          <RoomLabel
            key={label.region.id}
            at={label.region.labelAt}
            name={label.name}
            width={label.width}
          />
        ))}
    </Pane>
  );
}

function RoomLabel({ at, name, width }: { at: [number, number]; name: string; width: number }) {
  const icon = useMemo(() => {
    // The name goes in as text, never as HTML: room names are typed by admins.
    const text = document.createElement('span');
    text.textContent = name;
    text.dataset.roomLabel = '';
    const boxWidth = Math.ceil(width) + 2;
    return L.divIcon({
      className: styles.label,
      html: text,
      iconSize: [boxWidth, 16],
      iconAnchor: [boxWidth / 2, 8],
    });
  }, [name, width]);
  return (
    <Marker
      position={toLatLng({ x: at[0], y: at[1] })}
      icon={icon}
      interactive={false}
      keyboard={false}
    />
  );
}

/**
 * The CSS font of a room name, for measuring it. Measured again once the
 * app's typeface has loaded, since a fallback font has different widths.
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
    () => `500 ${LABEL_FONT_SIZE} ${getComputedStyle(container).fontFamily}`,
    // fontsLoaded: re-read after the typeface arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [container, fontsLoaded],
  );
}

let measuringContext: CanvasRenderingContext2D | null | undefined;

/** How wide `text` is in `font`, in pixels. */
function measureText(text: string, font: string): number {
  if (measuringContext === undefined) {
    // Test runs (jsdom) have no canvas; they get an estimate instead.
    measuringContext = /jsdom/i.test(navigator.userAgent)
      ? null
      : document.createElement('canvas').getContext('2d');
  }
  if (!measuringContext) return text.length * 7.5;
  measuringContext.font = font;
  // A couple of extra pixels: canvas and the page can round a font differently.
  return measuringContext.measureText(text).width + 2;
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
