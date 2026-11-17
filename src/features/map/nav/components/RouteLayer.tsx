// The route on the floor in view: a dark line (light in dark mode) with a
// soft glow, the destination pin, and a chip at each change of floor.
//
// Only this floor's stretch is drawn: the other floors' parts would sit on
// top of rooms they don't go through. The chip at the stairs or lift says
// what to do and switches floor when tapped.
//
// The line is half a metre wide on the floor, so it thins and thickens at
// exactly the rate the plan zooms (planScale.ts). A new route draws itself in
// along its length with Motion, unless the device asks for less motion.
import type L from 'leaflet';
import { animate } from 'motion/react';
import { useEffect, useRef } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import { duration, easeOut, prefersReducedMotion } from '@/lib/motion';
import type { RouteOk } from '../router.ts';
import { routeLineWeight } from '../planScale.ts';
import { floorChanges, legsOnFloor } from '../routeView.ts';
import type { FloorId } from '../types.ts';
import { toLatLng } from './latlng.ts';
import { DestinationPin, FloorChangeChip } from './NavPins.tsx';
import styles from './RouteLayer.module.css';

interface RouteLayerProps {
  result: RouteOk;
  /** The plan's scale (geometry.metresPerUnit), to size the line in metres. */
  metresPerUnit: number;
  floor: FloorId;
  zoom: number;
  destinationName: string;
  onShowFloor: (floor: FloorId) => void;
  /** Margins (px) kept clear of the floating controls when fitting the view. */
  padding: { top: number; bottom: number };
}

const floorWord = (id: FloorId) => (id === 'G' ? 'the ground floor' : `floor ${id}`);

export function RouteLayer({
  result,
  metresPerUnit,
  floor,
  zoom,
  destinationName,
  onShowFloor,
  padding,
}: RouteLayerProps) {
  const legs = legsOnFloor(result, floor);
  const changes = floorChanges(result);
  const weight = routeLineWeight(zoom, metresPerUnit);
  const last = result.legs[result.legs.length - 1];
  const end = last?.points[last.points.length - 1];
  // A new route (or floor) re-mounts the lines, which replays the draw-in.
  const routeKey = `${floor}:${result.distanceM}:${result.legs.length}:${result.legs[0]?.points[0]?.x}`;

  return (
    <>
      {legs.map((leg, i) => (
        <RouteLine key={`${routeKey}:${i}`} points={leg.points} weight={weight} />
      ))}
      {last?.floor === floor && end && <DestinationPin at={end} title={destinationName} />}
      {changes
        .filter((change) => change.fromFloor === floor)
        .map((change) => (
          <FloorChangeChip
            key={`go:${change.fromFloor}:${change.toFloor}`}
            at={change.at}
            text={change.text}
            onPick={() => onShowFloor(change.toFloor)}
          />
        ))}
      {changes
        .filter((change) => change.toFloor === floor)
        .map((change) => {
          const arrival = result.legs.find((leg) => leg.floor === floor)?.points[0];
          return arrival ? (
            <FloorChangeChip
              key={`back:${change.fromFloor}:${change.toFloor}`}
              at={arrival}
              text={`Came from ${floorWord(change.fromFloor)}`}
              onPick={() => onShowFloor(change.fromFloor)}
            />
          ) : null;
        })}
      <FitToRoute
        routeKey={routeKey}
        points={legs.flatMap((leg) => leg.points)}
        padding={padding}
      />
    </>
  );
}

function RouteLine({ points, weight }: { points: { x: number; y: number }[]; weight: number }) {
  const glow = useRef<L.Polyline>(null);
  const line = useRef<L.Polyline>(null);
  const positions = points.map(toLatLng);

  // Draw in once, when this stretch first appears.
  //
  // The dash is measured as a share of the line (pathLength = 1), not in
  // pixels: Leaflet redraws the line at a new pixel length on every zoom, and
  // a dash measured in pixels would then stop short of the destination. Once
  // the line is drawn the dash is removed altogether.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const paths = [glow.current, line.current]
      .map((layer) => layer?.getElement() as SVGPathElement | undefined)
      .filter((path): path is SVGPathElement => Boolean(path));
    const reset = () => {
      for (const path of paths) {
        path.removeAttribute('pathLength');
        path.style.strokeDasharray = '';
        path.style.strokeDashoffset = '';
      }
    };
    const controls = paths.map((path) => {
      path.setAttribute('pathLength', '1');
      path.style.strokeDasharray = '1';
      return animate(
        path,
        { strokeDashoffset: [1, 0] },
        { duration: (duration.slow * 2) / 1000, ease: easeOut },
      );
    });
    void Promise.all(controls.map((control) => control.finished)).then(reset, reset);
    return () => {
      controls.forEach((control) => control.stop());
      reset();
    };
  }, []);

  return (
    <>
      <Polyline
        ref={glow}
        positions={positions}
        interactive={false}
        className={styles.glow}
        pathOptions={{ weight: weight * 2.6 }}
      />
      <Polyline
        ref={line}
        positions={positions}
        interactive={false}
        className={styles.line}
        pathOptions={{ weight }}
      />
    </>
  );
}

/** Moves the view to this floor's stretch of the route when the route or floor changes. */
function FitToRoute({
  routeKey,
  points,
  padding,
}: {
  routeKey: string;
  points: { x: number; y: number }[];
  padding: { top: number; bottom: number };
}) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(points.map(toLatLng), {
      paddingTopLeft: [24, padding.top],
      paddingBottomRight: [24, padding.bottom],
      maxZoom: 0,
      animate: !prefersReducedMotion(),
    });
    // Only a new route or floor moves the view, not every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);
  return null;
}
