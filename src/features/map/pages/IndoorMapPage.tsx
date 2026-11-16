// The indoor campus map with directions (MAP_NOTES.md, spec section 4).
//
// The traced floor plan fills the screen; glass controls float on top (where
// to, floor, layers) and the directions panel sits at the bottom above the
// tab bar. A student picks where to go (search, or tap a room), says where
// they are (drop the "I'm here" pin, or name the nearest classroom), and
// gets a route: the line on each floor, a chip at each change of floor, and
// the steps one by one. Routes are worked out in the browser by the shared
// router (NavRouterProvider), and again whenever stairs, lifts or room names
// change (Realtime), so a lift marked out of order reroutes open maps.
//
// Until the release that switches the map over (MAP_NOTES, phase 6) this
// screen is at /map/indoor for staff; /map shows it when VITE_INDOOR_MAP=true.
// Its fix-it and "in use now" layers place reports and bookings through
// rooms.region_id, so they fill in once rooms migration B has run.
//
// The address keeps ?to=<id>&from=<id> (ids from the map) so a route can be
// linked to; ?report=<id> opens a fix-it report.
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterChip } from '@/components/Chip';
import { PageChrome } from '@/components/PageChrome';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ErrorState, LoadingState } from '@/components/States';
import { useCurrentUser } from '@/features/auth/hooks';
import { OPEN_STATUSES } from '@/features/fixit/api';
import { ReportCard } from '@/features/fixit/components/ReportCard';
import { useLiveReports, useReports } from '@/features/fixit/hooks';
import { reportTitle } from '@/features/fixit/logic';
import { useBookingsNow, useLiveBookings, useVenues } from '@/features/venues/hooks';
import { isAdmin } from '@/lib/permissions';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { DestinationSearch } from '../components/DestinationSearch';
import { DirectionsPanel } from '../components/DirectionsPanel';
import { roomsInUse } from '../logic';
import { searchableDestinations, type Destination } from '../nav/assignments';
import { FloorPlanView } from '../nav/components/FloorPlanView';
import { BusyDot, HereMarker, ReportCountPin } from '../nav/components/NavPins';
import { RouteLayer } from '../nav/components/RouteLayer';
import { indexGeometry } from '../nav/graph';
import { useTracedRooms } from '../nav/hooks';
import { destinationEnd } from '../nav/routeEnds';
import type { RouteEnd, RouteMode, Router } from '../nav/router';
import { NavRouterProvider } from '../nav/RouterProvider';
import { useNavRouter } from '../nav/routerContext';
import { floorLabel, startFloor } from '../nav/routeView';
import { snapStart } from '../nav/startPoint';
import type { FloorId, Geometry, Point } from '../nav/types';
import styles from './MapPage.module.css';

// Where the plan fits on screen, clear of the floating controls (px).
const PLAN_MARGINS = { top: 132, bottom: 150 };
const ROUTE_MARGINS = { top: 140, bottom: 380 };
const STEP_FREE_KEY = 'campus.map.stepFree';

function readStepFree(): boolean {
  try {
    return window.localStorage.getItem(STEP_FREE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveStepFree(value: boolean) {
  try {
    window.localStorage.setItem(STEP_FREE_KEY, String(value));
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}

export function IndoorMapPage() {
  useDocumentTitle('Campus map');
  return (
    <NavRouterProvider>
      <IndoorMap />
    </NavRouterProvider>
  );
}

function IndoorMap() {
  const { geometry, router, ready, error } = useNavRouter();
  if (error) return <ErrorState error={error} />;
  if (!geometry || !router || !ready)
    return <LoadingState shape="block" label="Loading the map…" />;
  return <MapScreen geometry={geometry} router={router} />;
}

type Pin = { floor: FloorId; point: Point; end: RouteEnd };
type Layer = 'reports' | 'inUse';

export function MapScreen({ geometry, router }: { geometry: Geometry; router: Router }) {
  const { version, assignments } = useNavRouter();
  const user = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const index = useMemo(() => indexGeometry(geometry), [geometry]);

  const destinations = useMemo(
    () => searchableDestinations(geometry, assignments),
    [geometry, assignments],
  );
  const byId = useMemo(() => new Map(destinations.map((d) => [d.roomId, d])), [destinations]);
  const names = useMemo(
    () => Object.fromEntries(destinations.map((d) => [d.roomId, d.name])),
    [destinations],
  );
  const named = useMemo(() => new Set(destinations.map((d) => d.roomId)), [destinations]);

  // ?room=<code> is how other screens link to a room on the old map. A traced
  // room's code is its map id, so after migration B those links land here too.
  const destination = byId.get(params.get('to') ?? params.get('room') ?? '') ?? null;
  const fromPlace = byId.get(params.get('from') ?? '') ?? null;
  const [pin, setPin] = useState<Pin | null>(null);
  const start = fromPlace
    ? ({ kind: 'place', destination: fromPlace } as const)
    : pin
      ? ({ kind: 'pin', floor: pin.floor } as const)
      : null;

  const [floor, setFloor] = useState<FloorId>(destination?.floor ?? geometry.floors[0]?.id ?? 'G');
  const [zoom, setZoom] = useState(-2);
  const [tapping, setTapping] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(Boolean(destination || fromPlace));
  const [stepFree, setStepFreeState] = useState(readStepFree);
  const [stepIndex, setStepIndex] = useState(0);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ reports: true, inUse: true });

  function setStepFree(value: boolean) {
    setStepFreeState(value);
    saveStepFree(value);
  }

  // The address holds the two ends, so a route can be shared or reopened.
  function setEnds(change: { to?: string | null; from?: string | null }) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(change)) {
      if (value === undefined) continue;
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    next.delete('report');
    next.delete('room');
    setParams(next, { replace: true });
  }

  // ---------- The route ----------
  const mode: RouteMode = stepFree ? 'step-free' : 'standard';
  const fromEnd: RouteEnd | null = fromPlace ? destinationEnd(fromPlace) : (pin?.end ?? null);
  const toEnd: RouteEnd | null = destination ? destinationEnd(destination) : null;
  const endsKey = `${JSON.stringify(fromEnd)}|${JSON.stringify(toEnd)}|${mode}`;
  const result = useMemo(
    () => (fromEnd && toEnd ? router.route(fromEnd, toEnd, { mode }) : null),
    // version: the router got new stairs, lifts, flags or names, so route again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, version, endsKey],
  );

  // A new trip (other ends or mode) starts at step 1 on its first floor. A
  // reroute of the same trip (version) keeps the student where they are.
  const [shownTrip, setShownTrip] = useState('');
  if (result && endsKey !== shownTrip) {
    setShownTrip(endsKey);
    setStepIndex(0);
    if (result.ok) setFloor(startFloor(result) ?? floor);
  }
  const step = result?.ok ? Math.min(stepIndex, result.steps.length - 1) : 0;

  const showStep = useCallback(
    (index: number) => {
      if (!result?.ok) return;
      setStepIndex(index);
      setFloor(result.steps[index].floor);
    },
    [result],
  );

  // ---------- Picking ends ----------
  function pickDestination(d: Destination) {
    setEnds({ to: d.roomId });
    setFloor(d.floor);
    setPanelOpen(true);
  }

  function pickStart(d: Destination) {
    setPin(null);
    setTapping(false);
    setPinMessage(null);
    setEnds({ from: d.roomId });
  }

  function dropPin(where: Point, onFloor: FloorId) {
    const snap = snapStart(index, onFloor, where);
    if (!snap.ok) {
      setPinMessage(snap.message);
      return;
    }
    setPin({ floor: onFloor, point: snap.point, end: snap.end });
    setPinMessage(null);
    setTapping(false);
    if (fromPlace) setEnds({ from: null });
  }

  // ---------- Layers ----------
  const tracedRooms = useTracedRooms().data;
  const reports = useReports();
  const venues = useVenues();
  const bookingsNow = useBookingsNow();
  useLiveReports();
  useLiveBookings();

  const spotOf = useMemo(() => {
    const spots = new Map<string, { floor: FloorId; at: Point }>();
    for (const region of geometry.regions) {
      spots.set(region.id, {
        floor: region.floor,
        at: { x: region.labelAt[0], y: region.labelAt[1] },
      });
    }
    for (const place of geometry.places) spots.set(place.id, { floor: place.floor, at: place });
    return spots;
  }, [geometry]);

  const openReports = (reports.data ?? []).filter((r) => OPEN_STATUSES.includes(r.status));
  const reportsByRegion = new Map<string, typeof openReports>();
  for (const report of openReports) {
    const region = report.room_id ? tracedRooms?.[report.room_id] : undefined;
    if (!region) continue;
    reportsByRegion.set(region, [...(reportsByRegion.get(region) ?? []), report]);
  }
  const floorReportSpots = [...reportsByRegion.entries()].filter(
    ([region]) => spotOf.get(region)?.floor === floor,
  );
  const busy = roomsInUse(bookingsNow.data ?? [], venues.data ?? []);
  const busySpots = [...busy.entries()].flatMap(([roomId, booking]) => {
    const region = tracedRooms?.[roomId];
    const spot = region ? spotOf.get(region) : undefined;
    return spot && spot.floor === floor ? [{ region, spot, booking }] : [];
  });
  const selectedReport = openReports.find((r) => r.id === params.get('report'));
  const reportsHere = selectedReport?.room_id
    ? (reportsByRegion.get(tracedRooms?.[selectedReport.room_id] ?? '') ?? [selectedReport])
    : selectedReport
      ? [selectedReport]
      : [];

  const sheetOpen = Boolean(selectedReport || panelOpen);
  const margins = result?.ok ? ROUTE_MARGINS : PLAN_MARGINS;

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">Campus map</h1>
      <PageChrome attributes={{ 'data-sheet': sheetOpen || undefined }}>
        <FloorPlanView
          geometry={geometry}
          floor={floor}
          label={`${floorLabel(floor)} plan. ${
            tapping ? 'Tap where you are.' : 'Tap a room to get directions to it.'
          }`}
          named={named}
          names={names}
          selectedId={destination?.floor === floor ? destination.roomId : null}
          immersive={PLAN_MARGINS}
          onZoom={setZoom}
          crosshair={tapping}
          onSelect={
            tapping
              ? undefined
              : (id) => {
                  const picked = byId.get(id);
                  if (picked) pickDestination(picked);
                }
          }
          onMapClick={tapping ? (point) => dropPin(point, floor) : undefined}
        >
          {layers.inUse &&
            busySpots.map(({ region, spot, booking }) => (
              <BusyDot key={`busy:${region}`} at={spot.at} title={`In use now: ${booking.title}`} />
            ))}
          {layers.reports &&
            floorReportSpots.map(([region, list]) => {
              const spot = spotOf.get(region);
              if (!spot) return null;
              return (
                <ReportCountPin
                  key={`report:${region}`}
                  at={spot.at}
                  count={list.length}
                  title={
                    list.length === 1
                      ? `Fix-it report: ${reportTitle(list[0].description)}`
                      : `${list.length} fix-it reports`
                  }
                  onSelect={() => {
                    const next = new URLSearchParams(params);
                    next.set('report', list[0].id);
                    setParams(next, { replace: true });
                  }}
                />
              );
            })}
          {result?.ok && (
            <RouteLayer
              result={result}
              floor={floor}
              zoom={zoom}
              destinationName={destination?.name ?? ''}
              onShowFloor={setFloor}
              padding={margins}
            />
          )}
          {pin && pin.floor === floor && (
            <HereMarker at={pin.point} onDrop={(point) => dropPin(point, floor)} />
          )}
        </FloorPlanView>

        <div className={styles.top}>
          <div className={styles.topRow}>
            <DestinationSearch
              destinations={destinations}
              label="Where to?"
              onPick={pickDestination}
            />
            <SegmentedControl
              label="Floor"
              compact
              floating
              value={floor}
              onChange={setFloor}
              options={geometry.floors.map((f) => ({ value: f.id, label: f.id }))}
            />
          </div>
          <div className={`scroll-row ${styles.chips}`} role="group" aria-label="Show on the map">
            <FilterChip
              glass
              marker="report"
              selected={layers.reports}
              onClick={() => setLayers((l) => ({ ...l, reports: !l.reports }))}
            >
              {floorReportSpots.length > 0
                ? `${floorReportSpots.reduce((n, [, list]) => n + list.length, 0)} open fix-it reports`
                : 'Fix-it reports'}
            </FilterChip>
            <FilterChip
              glass
              marker="busy"
              selected={layers.inUse}
              onClick={() => setLayers((l) => ({ ...l, inUse: !l.inUse }))}
            >
              In use now
            </FilterChip>
          </div>
        </div>

        <div className={styles.bottom}>
          {selectedReport ? (
            <ReportCard
              report={selectedReport}
              others={reportsHere}
              onPick={(id) => {
                const next = new URLSearchParams(params);
                next.set('report', id);
                setParams(next, { replace: true });
              }}
            />
          ) : panelOpen ? (
            <DirectionsPanel
              destinations={destinations}
              start={start}
              destination={destination}
              tapping={tapping}
              pinMessage={pinMessage}
              stepFree={stepFree}
              result={result}
              stepIndex={step}
              isAdmin={isAdmin(user)}
              onTapToStart={() => {
                setTapping((t) => !t);
                setPinMessage(null);
              }}
              onPickStart={pickStart}
              onPickDestination={pickDestination}
              onClearStart={() => {
                setPin(null);
                setEnds({ from: null });
              }}
              onClearDestination={() => setEnds({ to: null })}
              onSwap={() => {
                if (fromPlace && destination) {
                  setEnds({ from: destination.roomId, to: fromPlace.roomId });
                }
              }}
              onStepFree={setStepFree}
              onStep={showStep}
              onClose={() => {
                setPanelOpen(false);
                setTapping(false);
                setPin(null);
                setEnds({ to: null, from: null });
              }}
            />
          ) : (
            <button
              type="button"
              className={`glass thin ${styles.hint} ${styles.hintButton}`}
              onClick={() => setPanelOpen(true)}
            >
              Get directions
            </button>
          )}
        </div>
      </PageChrome>
    </div>
  );
}
